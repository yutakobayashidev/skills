export function UserProfile({ user }: { user: { name: string; email: string } }) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
