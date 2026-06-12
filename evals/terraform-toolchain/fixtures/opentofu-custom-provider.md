# OpenTofu Custom Provider Scenario

The project uses OpenTofu and needs one provider that is not available in nixpkgs.

Keep common providers in `opentofu.withPlugins` and add the missing provider with `opentofu.plugins.mkProvider`.
