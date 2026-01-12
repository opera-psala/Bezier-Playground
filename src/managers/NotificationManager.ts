export type NotificationType = 'success' | 'error' | 'info';

export interface NotificationOptions {
  duration?: number;
}

export class NotificationManager {
  private readonly DEFAULT_DURATION = 1500;

  showNotification(
    message: string,
    type: NotificationType = 'success',
    options?: NotificationOptions
  ): void {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '4rem';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.background = this.getBackgroundColor(type);
    notification.style.color = 'white';
    notification.style.padding = '0.5rem 1rem';
    notification.style.borderRadius = '4px';
    notification.style.fontSize = '14px';
    notification.style.zIndex = '10000';
    notification.style.pointerEvents = 'none';
    notification.style.whiteSpace = 'nowrap';

    document.body.appendChild(notification);

    const duration = options?.duration ?? this.DEFAULT_DURATION;
    setTimeout(() => {
      notification.remove();
    }, duration);
  }

  showBranchSwitchNotification(
    currentBranch: number,
    totalBranches: number,
    description: string
  ): void {
    const message = `Branch ${currentBranch} of ${totalBranches} - ${description}`;
    this.showNotification(message, 'info');
  }

  private getBackgroundColor(type: NotificationType): string {
    switch (type) {
      case 'error':
        return 'rgba(255, 74, 74, 0.9)';
      case 'info':
        return 'rgba(74, 158, 255, 0.9)';
      case 'success':
      default:
        return 'rgba(74, 158, 255, 0.9)';
    }
  }
}
