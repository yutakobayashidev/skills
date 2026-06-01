// renders notifications AND handles user settings in one component
export function NotificationList() {
  return (
    <div>
      <h2>Notifications</h2>
      <ul>{notifications.map(n => <li key={n.id}>{n.text}</li>)}</ul>
      <h2>Notification Settings</h2>
      <form><label>Email <input type='checkbox' /></label></form>
    </div>
  );
}