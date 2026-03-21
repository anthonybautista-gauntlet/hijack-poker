import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Divider,
  Chip,
} from '@mui/material';
import { login } from '../store';
import { rewardsApi } from '../api/rewardsApi';

/** Seeded players from MySQL init script */
const SEEDED_PLAYERS = [
  { id: 'p1-uuid-0001', name: 'Alice' },
  { id: 'p2-uuid-0002', name: 'Bob' },
  { id: 'p3-uuid-0003', name: 'Charlie' },
  { id: 'p4-uuid-0004', name: 'Diana' },
  { id: 'p5-uuid-0005', name: 'Eve' },
  { id: 'p6-uuid-0006', name: 'Frank' },
];

function Login() {
  const [playerId, setPlayerId] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = (id?: string) => {
    const targetId = id ?? playerId.trim();
    if (targetId) {
      localStorage.setItem('playerId', targetId);
      dispatch(rewardsApi.util.resetApiState());
      dispatch(login(targetId));
      navigate('/');
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 10 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Rewards Login
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter a player ID to view rewards. This is a stub — no real
          authentication.
        </Typography>
        <TextField
          fullWidth
          label="Player ID"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          placeholder="e.g. p1-uuid-0001"
          sx={{ mb: 2 }}
        />
        <Button
          fullWidth
          variant="contained"
          onClick={() => handleLogin()}
          disabled={!playerId.trim()}
        >
          Login
        </Button>

        <Divider sx={{ my: 3 }}>
          <Typography variant="caption" color="text.secondary">
            Quick Select
          </Typography>
        </Divider>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
          {SEEDED_PLAYERS.map((player) => (
            <Chip
              key={player.id}
              label={player.name}
              onClick={() => handleLogin(player.id)}
              variant="outlined"
              color="primary"
              clickable
              sx={{
                fontWeight: 500,
                '&:hover': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                },
              }}
            />
          ))}
        </Box>
      </Paper>
    </Container>
  );
}

export default Login;
