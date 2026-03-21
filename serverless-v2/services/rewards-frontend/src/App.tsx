import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import { logout } from './store';
import { useGetPlayerRewardsQuery } from './api/rewardsApi';

function AppNavBar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const playerId = localStorage.getItem('playerId');
  const { data } = useGetPlayerRewardsQuery(undefined, { skip: !playerId });

  const displayName = data?.displayName || playerId || '';

  const handleLogout = () => {
    localStorage.removeItem('playerId');
    dispatch(logout());
    navigate('/login');
  };

  return (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <Toolbar>
        <EmojiEventsIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
          Hijack Rewards
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mx: 2 }}>
          {displayName}
        </Typography>
        <Button color="inherit" size="small" onClick={handleLogout}>
          Logout
        </Button>
      </Toolbar>
    </AppBar>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const playerId = localStorage.getItem('playerId');
  if (!playerId) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Box>
      <AppNavBar />
      {children}
    </Box>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
