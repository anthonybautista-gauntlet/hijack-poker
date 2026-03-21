import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { rewardsApi } from './api/rewardsApi';

interface AuthState {
  playerId: string | null;
  isAuthenticated: boolean;
}

const authSlice = createSlice({
  name: 'auth',
  initialState: { playerId: null, isAuthenticated: false } as AuthState,
  reducers: {
    login(state, action: PayloadAction<string>) {
      state.playerId = action.payload;
      state.isAuthenticated = true;
    },
    logout(state) {
      state.playerId = null;
      state.isAuthenticated = false;
    },
  },
});

export const { login, logout } = authSlice.actions;

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    [rewardsApi.reducerPath]: rewardsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(rewardsApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
