import { LockKeyIcon } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// Shared admin-only notice for /admin and /admin/gifts. Marks the signed in
// user as an admin and explains how to grant admin access to someone else.
export function AdminAccessNote() {
  const viewer = useQuery(api.authz.viewer, {});

  return (
    <aside className="admin-access-note" role="note">
      <div className="admin-access-head">
        <LockKeyIcon aria-hidden="true" />
        <strong>Admin only area</strong>
        {viewer?.isAdmin ? (
          <span className="admin-chip">
            Admin{viewer.xUsername ? ` · @${viewer.xUsername}` : ""}
          </span>
        ) : null}
      </div>
      <p>
        This page and the Gift studio never appear to regular visitors. Access
        is granted by the <code>ADMIN_X_USER_IDS</code> allowlist checked on
        every request by Convex Auth.
      </p>
      <details>
        <summary>How to make another user an admin</summary>
        <ol>
          <li>
            Get the person&apos;s numeric X user ID. A lookup tool like{" "}
            <a href="https://ilo.so/twitter-id/" target="_blank" rel="noreferrer noopener">
              ilo.so/twitter-id
            </a>{" "}
            finds it from their @handle.
          </li>
          <li>
            Open the Convex dashboard for this project and go to Settings, then
            Environment Variables.
          </li>
          <li>
            Edit <code>ADMIN_X_USER_IDS</code> and add the new ID to the list,
            separated by a comma. Example: <code>123456789,987654321</code>.
          </li>
          <li>
            Save. The person signs in at <code>/admin</code> with their X
            account and has access right away. Remove their ID from the list to
            revoke access.
          </li>
        </ol>
      </details>
    </aside>
  );
}
