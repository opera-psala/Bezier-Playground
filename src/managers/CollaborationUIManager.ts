import { User } from '../types';
import { CollaborationManager } from '../collaboration/CollaborationManager';
import { CurveManager } from './CurveManager';

export class CollaborationUIManager {
  private toggleButton: HTMLButtonElement;
  private onlineUsers: HTMLDivElement;
  private onlineCount: HTMLSpanElement;
  private userList: HTMLDivElement;
  private collaborationManager: CollaborationManager;
  private curveManager: CurveManager;

  constructor(collaborationManager: CollaborationManager, curveManager: CurveManager) {
    this.collaborationManager = collaborationManager;
    this.curveManager = curveManager;

    this.toggleButton = document.getElementById('toggle-collaboration') as HTMLButtonElement;
    this.onlineUsers = document.getElementById('online-users') as HTMLDivElement;
    this.onlineCount = document.getElementById('online-count') as HTMLSpanElement;
    this.userList = document.getElementById('user-list') as HTMLDivElement;

    if (!this.toggleButton || !this.onlineUsers || !this.onlineCount || !this.userList) {
      throw new Error('Collaboration UI elements not found');
    }

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.toggleButton.addEventListener('click', () => {
      if (this.collaborationManager.isEnabled()) {
        this.collaborationManager.disable();
        this.toggleButton.textContent = 'Enable Collaboration';
        this.onlineUsers.style.display = 'none';
      } else {
        // Prompt for user name
        const userName = prompt('Enter your name for collaboration:', '');
        if (userName === null) {
          // User cancelled
          return;
        }

        const displayName = userName.trim() || 'Anonymous';

        // Ensure there's at least one curve before enabling collaboration
        let currentCurves = this.curveManager.getAllCurves();
        if (currentCurves.length === 0) {
          this.curveManager.addCurve();
          currentCurves = this.curveManager.getAllCurves();
        }

        this.collaborationManager.enable(currentCurves, displayName);
        this.toggleButton.textContent = 'Disable Collaboration';
        this.onlineUsers.style.display = 'flex';
      }
    });
  }

  updateUsers(users: User[], localUserId: string): void {
    const count = users.length;
    this.onlineCount.textContent = `${count} user${count !== 1 ? 's' : ''} online`;

    this.userList.innerHTML = '';
    users.forEach(user => {
      const isLocalUser = user.id === localUserId;
      const avatar = document.createElement('div');
      avatar.className = 'user-avatar';
      avatar.style.borderColor = user.color;
      avatar.style.backgroundColor = user.color;
      avatar.textContent = user.name.charAt(0).toUpperCase();
      avatar.title = isLocalUser ? `${user.name} (You)` : user.name;

      // Add visual indicator for local user
      if (isLocalUser) {
        avatar.style.opacity = '0.7';
        avatar.style.border = '2px solid #fff';
      }

      this.userList.appendChild(avatar);
    });
  }
}
