import { useState } from 'react';
import {
  Badge,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Popover,
  Typography,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import StarIcon from '@mui/icons-material/Star';
import CloseIcon from '@mui/icons-material/Close';
import {
  useGetNotificationsQuery,
  useDismissNotificationMutation,
} from '../api/rewardsApi';
import type { Notification } from '../api/rewardsApi';

const typeIcons: Record<string, { icon: React.ElementType; color: string }> = {
  tier_upgrade: { icon: ArrowUpwardIcon, color: '#3FB950' },
  tier_downgrade: { icon: ArrowDownwardIcon, color: '#F85149' },
  milestone: { icon: StarIcon, color: '#FFD700' },
};

function formatTimeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const { data } = useGetNotificationsQuery({ unread: false });
  const [dismissNotification] = useDismissNotificationMutation();

  const open = Boolean(anchorEl);
  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDismiss = (id: string) => {
    dismissNotification(id);
  };

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen}>
        <Badge
          badgeContent={unreadCount}
          color="secondary"
          max={9}
          invisible={unreadCount === 0}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.65rem',
              minWidth: 18,
              height: 18,
            },
          }}
        >
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: 360,
            maxHeight: 420,
            bgcolor: 'background.paper',
            border: '1px solid rgba(255,255,255,0.08)',
          },
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Notifications
          </Typography>
        </Box>

        {/* Notification list or empty state */}
        {notifications.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <NotificationsNoneIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No notifications
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ overflowY: 'auto', maxHeight: 340 }}>
            {notifications.map((n: Notification) => {
              const typeConfig = typeIcons[n.type] || typeIcons.milestone;
              const TypeIcon = typeConfig.icon;

              return (
                <ListItem
                  key={n.notificationId}
                  sx={{
                    borderLeft: n.dismissed ? 'none' : '3px solid #6C63FF',
                    transition: 'opacity 0.3s ease-out',
                    opacity: n.dismissed ? 0.5 : 1,
                    py: 1.5,
                    alignItems: 'flex-start',
                  }}
                  secondaryAction={
                    !n.dismissed ? (
                      <IconButton
                        size="small"
                        onClick={() => handleDismiss(n.notificationId)}
                        sx={{ mt: 0.5 }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ) : undefined
                  }
                >
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                    <TypeIcon sx={{ color: typeConfig.color, fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={600}>
                        {n.title}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography variant="body2" color="text.secondary" component="span">
                          {n.message}
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary" component="span">
                          {formatTimeAgo(n.createdAt)}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </Popover>
    </>
  );
}
