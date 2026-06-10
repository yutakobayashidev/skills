#!/usr/bin/env python3
"""Print GitHub release notes for a tag range."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Release:
    tag: str
    name: str
    url: str
    published_at: str
    body: str


def parse_repo(value: str) -> str:
    if value.startswith("https://github.com/"):
        parsed = urllib.parse.urlparse(value)
        parts = parsed.path.strip("/").split("/")
        if len(parts) >= 2:
            return f"{parts[0]}/{parts[1]}"
    if value.count("/") == 1 and not value.startswith("/"):
        return value
    raise ValueError("repo must be owner/repo or https://github.com/owner/repo")


def request_json(url: str, token: Optional[str]) -> object:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "gha-lint-release-notes",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API error {err.code}: {detail}") from err


def default_token() -> Optional[str]:
    env_token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
    if env_token:
        return env_token
    try:
        result = subprocess.run(
            ["gh", "auth", "token"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None
    token = result.stdout.strip()
    return token or None


def fetch_releases(repo: str, token: Optional[str]) -> list[Release]:
    releases: list[Release] = []
    for page in range(1, 11):
        url = f"https://api.github.com/repos/{repo}/releases?per_page=100&page={page}"
        data = request_json(url, token)
        if not isinstance(data, list):
            raise RuntimeError("GitHub API returned an unexpected response")
        if not data:
            break
        for item in data:
            releases.append(
                Release(
                    tag=item.get("tag_name", ""),
                    name=item.get("name") or item.get("tag_name", ""),
                    url=item.get("html_url", ""),
                    published_at=item.get("published_at") or item.get("created_at", ""),
                    body=item.get("body") or "",
                )
            )
    return releases


def tag_key(tag: str) -> str:
    return tag[1:] if tag.startswith("v") else tag


def find_release(releases: list[Release], tag: str) -> Release:
    exact = [release for release in releases if release.tag == tag]
    if len(exact) == 1:
        return exact[0]

    normalized = tag_key(tag)
    matches = [release for release in releases if tag_key(release.tag) == normalized]
    if len(matches) == 1:
        return matches[0]
    if matches:
        tags = ", ".join(release.tag for release in matches)
        raise RuntimeError(f"tag {tag!r} is ambiguous: {tags}")
    raise RuntimeError(f"tag {tag!r} was not found in GitHub Releases")


def select_range(
    releases: list[Release],
    from_release: Release,
    to_release: Release,
    include_from: bool,
) -> list[Release]:
    if from_release.published_at > to_release.published_at:
        raise RuntimeError(
            f"--from {from_release.tag} is newer than --to {to_release.tag}; swap the tags"
        )

    selected = [
        release
        for release in releases
        if (
            release.published_at >= from_release.published_at
            if include_from
            else release.published_at > from_release.published_at
        )
        and release.published_at <= to_release.published_at
    ]
    return sorted(selected, key=lambda release: release.published_at)


def render_markdown(
    repo: str, from_tag: str, to_tag: str, releases: list[Release]
) -> str:
    lines = [f"# Release notes for `{repo}`: `{from_tag}` -> `{to_tag}`", ""]
    if not releases:
        lines.append("No GitHub Releases found in this range.")
        return "\n".join(lines)

    for release in releases:
        date = release.published_at.split("T", 1)[0]
        lines.extend(
            [
                f"## {release.name} (`{release.tag}`)",
                "",
                f"- Date: {date}",
                f"- URL: {release.url}",
                "",
                release.body.strip() or "_No release notes provided._",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Fetch GitHub release notes for a tag range, excluding --from "
            "and including --to by default."
        )
    )
    parser.add_argument("repo", help="GitHub repository, e.g. actions/checkout")
    parser.add_argument("--from", dest="from_tag", required=True, help="old tag")
    parser.add_argument("--to", dest="to_tag", required=True, help="new tag")
    parser.add_argument(
        "--include-from",
        action="store_true",
        help="include the --from release notes instead of treating it as the baseline",
    )
    parser.add_argument(
        "--token",
        default=default_token(),
        help="GitHub token; defaults to GITHUB_TOKEN, GH_TOKEN, or gh auth token",
    )
    args = parser.parse_args()

    try:
        repo = parse_repo(args.repo)
        releases = fetch_releases(repo, args.token)
        from_release = find_release(releases, args.from_tag)
        to_release = find_release(releases, args.to_tag)
        selected = select_range(releases, from_release, to_release, args.include_from)
        print(render_markdown(repo, from_release.tag, to_release.tag, selected), end="")
    except Exception as err:
        print(f"error: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
