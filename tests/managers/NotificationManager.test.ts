import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationManager } from '../../src/managers/NotificationManager';

describe('NotificationManager', () => {
  let notificationManager: NotificationManager;

  beforeEach(() => {
    // Clear body
    document.body.innerHTML = '';
    notificationManager = new NotificationManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('showNotification', () => {
    it('should display a success notification', () => {
      notificationManager.showNotification('Operation successful', 'success');

      const notifications = document.body.querySelectorAll('div');
      expect(notifications.length).toBeGreaterThan(0);
      const notification = notifications[0] as HTMLElement;
      expect(notification.textContent).toBe('Operation successful');
      expect(notification.style.background).toBe('rgba(74, 158, 255, 0.9)');
    });

    it('should display an error notification', () => {
      notificationManager.showNotification('Operation failed', 'error');

      const notification = document.body.querySelector('div') as HTMLElement;
      expect(notification).not.toBeNull();
      expect(notification?.textContent).toBe('Operation failed');
      expect(notification?.style.background).toBe('rgba(255, 74, 74, 0.9)');
    });

    it('should display an info notification', () => {
      notificationManager.showNotification('Information', 'info');

      const notification = document.body.querySelector('div') as HTMLElement;
      expect(notification).not.toBeNull();
      expect(notification?.textContent).toBe('Information');
      expect(notification?.style.background).toBe('rgba(74, 158, 255, 0.9)');
    });

    it('should default to success type', () => {
      notificationManager.showNotification('Default notification');

      const notification = document.body.querySelector('div') as HTMLElement;
      expect(notification?.style.background).toBe('rgba(74, 158, 255, 0.9)');
    });

    it('should remove notification after default duration', () => {
      notificationManager.showNotification('Test');

      expect(document.body.children.length).toBe(1);

      vi.advanceTimersByTime(1500);

      expect(document.body.children.length).toBe(0);
    });

    it('should respect custom duration', () => {
      notificationManager.showNotification('Test', 'success', { duration: 3000 });

      expect(document.body.children.length).toBe(1);

      vi.advanceTimersByTime(1500);
      expect(document.body.children.length).toBe(1);

      vi.advanceTimersByTime(1500);
      expect(document.body.children.length).toBe(0);
    });

    it('should have fixed position at top', () => {
      notificationManager.showNotification('Test', 'success');

      const notification = document.body.querySelector('div') as HTMLElement;
      expect(notification.style.position).toBe('fixed');
      expect(notification.style.top).toBe('4rem');
    });

    it('should center horizontally', () => {
      notificationManager.showNotification('Test');

      const notification = document.body.querySelector('div') as HTMLElement;
      expect(notification.style.left).toBe('50%');
      expect(notification.style.transform).toBe('translateX(-50%)');
    });

    it('should allow multiple notifications', () => {
      notificationManager.showNotification('First', 'success');
      notificationManager.showNotification('Second', 'error');
      notificationManager.showNotification('Third', 'info');

      expect(document.body.children.length).toBe(3);
    });

    it('should style notifications correctly', () => {
      notificationManager.showNotification('Test', 'success');

      const notification = document.body.querySelector('div') as HTMLElement;
      expect(notification.style.color).toBe('white');
      expect(notification.style.padding).toBe('0.5rem 1rem');
      expect(notification.style.borderRadius).toBe('4px');
      expect(notification.style.zIndex).toBe('10000');
    });
  });

  describe('showBranchSwitchNotification', () => {
    it('should display branch switch notification', () => {
      notificationManager.showBranchSwitchNotification(2, 3, 'Add point to Blue');

      const notification = document.body.querySelector('div');
      expect(notification).not.toBeNull();
      expect(notification?.textContent).toContain('Branch 2 of 3');
      expect(notification?.textContent).toContain('Add point to Blue');
    });

    it('should format branch message correctly', () => {
      notificationManager.showBranchSwitchNotification(1, 5, 'Move point in Pink');

      const notification = document.body.querySelector('div');
      expect(notification?.textContent).toBe('Branch 1 of 5 - Move point in Pink');
    });

    it('should use info styling', () => {
      notificationManager.showBranchSwitchNotification(1, 2, 'Test');

      const notification = document.body.querySelector('div') as HTMLElement;
      expect(notification.style.background).toBe('rgba(74, 158, 255, 0.9)');
    });

    it('should use default duration', () => {
      notificationManager.showBranchSwitchNotification(1, 2, 'Test');

      expect(document.body.children.length).toBe(1);

      vi.advanceTimersByTime(1500);
      expect(document.body.children.length).toBe(0);
    });
  });

  describe('notification cleanup', () => {
    it('should clean up old notifications', () => {
      notificationManager.showNotification('First', 'success', { duration: 1000 });

      vi.advanceTimersByTime(500);

      notificationManager.showNotification('Second', 'success', { duration: 1000 });

      vi.advanceTimersByTime(600);

      expect(document.body.children.length).toBe(1);
      const remainingDiv = document.body.querySelector('div');
      expect(remainingDiv?.textContent).toBe('Second');
    });

    it('should handle rapid notifications', () => {
      for (let i = 0; i < 10; i++) {
        notificationManager.showNotification(`Notification ${i}`, 'success');
      }

      expect(document.body.children.length).toBe(10);

      vi.advanceTimersByTime(1500);

      expect(document.body.children.length).toBe(0);
    });
  });
});
