import { TourStep } from 'modern-tour';

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    target: '#dashboard-heading',
    title: 'Welcome to 3D Hub',
    content: 'This is the Management Console for the 3D Artifact Digitisation Hub. Upload, manage, and share 3D scanned artefacts.',
  },
  {
    target: '#dashboard-about',
    title: 'About this tool',
    content: 'Assets are stored in the cloud and can be viewed interactively in the browser. Access is controlled at the team and user level.',
  },
  {
    target: '#dashboard-features',
    title: 'Feature overview',
    content: 'These cards summarise the key areas of the platform. Click "Open" on any card to navigate directly to that section.',
  },
  {
    target: '#dashboard-access-ref',
    title: 'Access control',
    content: 'A quick reference for how uploading, asset access, and share links work. Assets can be shared with specific users, teams, or made fully public.',
  },
];

export const ASSET_LIST_TOUR_STEPS: TourStep[] = [
  {
    target: '#asset-list-heading',
    title: 'Assets',
    content: 'All 3D artefact files are listed here. Supported formats are .ply, .spz, .splat, and .sog.',
  },
  {
    target: '#asset-upload-btn',
    title: 'Upload an asset',
    content: 'Click here to upload a new 3D scan file. Progress is shown in real time and the list refreshes automatically when done.',
  },
  {
    target: '#asset-table',
    title: 'Asset list',
    content: 'Each row shows the file name, size, last-modified date, and uploader. Use "Manage" to control access and shares, "Viewer" to preview in the browser, or "Delete" to remove the asset.',
  },
];

export const ASSET_DETAIL_TOUR_STEPS: TourStep[] = [
  {
    target: '#asset-detail-info',
    title: 'Asset details',
    content: 'This panel shows the asset ID, who uploaded it, and when. These fields are read-only.',
  },
  {
    target: '#asset-detail-tabs',
    title: 'Shares & Access tabs',
    content: 'Switch between "Shares" to manage shareable links and "Access" to control which users and teams can view this asset.',
  },
  {
    target: '#asset-shares-tab',
    title: 'Share links',
    content: 'Create unique share links here. A share can be public (no login needed) or restricted to specific users and teams. You can also set an expiry duration.',
  },
  {
    target: '#asset-access-tab',
    title: 'Manage access',
    content: 'Grant or revoke access to individual users or whole teams. All members of a team inherit the team\'s access automatically.',
  },
];

export const TEAM_LIST_TOUR_STEPS: TourStep[] = [
  {
    target: '#team-list-heading',
    title: 'Teams',
    content: 'Teams let you group users together so you can grant asset access to everyone in the team at once.',
  },
  {
    target: '#team-create-btn',
    title: 'Create a team',
    content: 'Click here to create a new team. Give it a name and an optional description.',
  },
  {
    target: '#team-table',
    title: 'Team list',
    content: 'Each row shows a team\'s name and description. Use "Manage" to open the team detail page where you can add or remove members.',
  },
];

export const TEAM_DETAIL_TOUR_STEPS: TourStep[] = [
  {
    target: '#team-detail-heading',
    title: 'Team details',
    content: 'This is the detail page for an individual team. Here you can manage who belongs to the team.',
  },
  {
    target: '#team-members-card',
    title: 'Team members',
    content: 'Add existing users to this team using the dropdown, or remove them using the "Remove" button. Any asset access granted to this team applies to all members.',
  },
];

export const USER_LIST_TOUR_STEPS: TourStep[] = [
  {
    target: '#user-list-heading',
    title: 'Users',
    content: 'All registered users of the platform are listed here. User accounts are backed by the Cognito user pool.',
  },
  {
    target: '#user-create-btn',
    title: 'Add a user',
    content: 'Click here to create a new user account with an email address. A temporary password will be set and the user will be prompted to change it on first login.',
  },
  {
    target: '#user-table',
    title: 'User list',
    content: 'Each row shows the user\'s email and role. Use "Make Admin" / "Remove Admin" to control admin privileges, "Reset Password" to set a new password, and "Delete" to remove the account.',
  },
];
