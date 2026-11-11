import React, { useState, useEffect } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  AlertTriangle,
  Heart,
  Gift,
  MessageSquare,
  Lock,
  LogOut,
  Send,
} from 'lucide-react';

interface TikTokStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Authorised streamer login state
  authenticatedStreamer: string | null;
  onStreamerLogin: (username: string, key: string) => Promise<{ ok: boolean; error?: string; username?: string }>;
  onStreamerLogout: () => void;
  // TikTok Live connection state via Socket.IO
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  connectedUsername: string | null;
  connectedRoomId: string | null;
  errorMessage: string | null;
  onConnectTikTok: (username: string) => void;
  onDisconnectTikTok: () => void;
  // Simulate / Debug passthrough triggers via Socket.IO
  onSimulateChat: (data: {
    uniqueId: string;
    nickname: string;
    comment: string;
    profilePictureUrl: string;
  }) => void;
  onSimulateLike: (data: {
    uniqueId: string;
    nickname: string;
    likeCount: number;
    totalLikeCount: number;
    profilePictureUrl: string;
  }) => void;
  onSimulateGift: (data: {
    uniqueId: string;
    nickname: string;
    giftName: string;
    diamondCount: number;
    repeatCount: number;
    repeatEnd: boolean;
    profilePictureUrl: string;
  }) => void;
  totalLikesCount: number;
  totalGiftsCount: number;
}

export const TikTokStreamModal: React.FC<TikTokStreamModalProps> = ({
  isOpen,
  onClose,
  authenticatedStreamer,
  onStreamerLogin,
  onStreamerLogout,
  connectionState,
  connectedUsername,
  connectedRoomId,
  errorMessage,
  onConnectTikTok,
  onDisconnectTikTok,
  onSimulateChat,
  onSimulateLike,
  onSimulateGift,
  totalLikesCount,
  totalGiftsCount,
}) => {
  // Streamer login state (autofills the @)
  const [authUsernameInput, setAuthUsernameInput] = useState('@');
  const [authKeyInput, setAuthKeyInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // TikTok Live @username input (autofills the @)
  const [liveHandleInput, setLiveHandleInput] = useState(
    authenticatedStreamer || '@'
  );

  // Simulate / Debug panel state
  const [simNickname, setSimNickname] = useState('Aurora Explorer');
  const [simAvatarUrl, setSimAvatarUrl] = useState('');
  const [simComment, setSimComment] = useState('polar!');
  const [simGiftName, setSimGiftName] = useState('Galaxy');

  useEffect(() => {
    if (authenticatedStreamer) {
      setLiveHandleInput(
        authenticatedStreamer.startsWith('@')
          ? authenticatedStreamer
          : `@${authenticatedStreamer}`
      );
    }
  }, [authenticatedStreamer]);

  if (!isOpen) return null;

  const ensureLeadingAt = (val: string) => {
    if (!val.startsWith('@')) {
      return '@' + val.replace(/^@+/, '');
    }
    return val;
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoggingIn(true);
    try {
      const res = await onStreamerLogin(authUsernameInput, authKeyInput);
      if (!res.ok) {
        setAuthError(res.error || 'Login failed');
      } else {
        setAuthKeyInput('');
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnectTikTok(liveHandleInput);
  };

  const handleFakeChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simComment.trim()) return;
    onSimulateChat({
      uniqueId: simNickname.toLowerCase().replace(/\s+/g, '_') || 'viewer_1',
      nickname: simNickname || 'TikTok Viewer',
      comment: simComment,
      profilePictureUrl: simAvatarUrl.trim(),
    });
    setSimComment('');
  };

  const handleFakeLikeClick = () => {
    onSimulateLike({
      uniqueId: simNickname.toLowerCase().replace(/\s+/g, '_') || 'viewer_1',
      nickname: simNickname || 'TikTok Viewer',
      likeCount: 15,
      totalLikeCount: totalLikesCount + 15,
      profilePictureUrl: simAvatarUrl.trim(),
    });
  };

  const handleFakeGiftClick = () => {
    onSimulateGift({
      uniqueId: simNickname.toLowerCase().replace(/\s+/g, '_') || 'viewer_1',
      nickname: simNickname || 'TikTok Viewer',
      giftName: simGiftName || 'Rose',
      diamondCount: 100,
      repeatCount: 1,
      repeatEnd: true,
      profilePictureUrl: simAvatarUrl.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-[490px] rounded-2xl bg-[#03142f] border-2 border-[#19e4ff] shadow-[0_0_32px_rgba(25,228,255,0.25)] text-[#f3f8ff] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1768b3]/60 bg-[#061c3d]">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-[#19e4ff]" />
            <div>
              <h2 className="text-base font-bold tracking-tight">
                TikTok Live Connection
              </h2>
              <p className="text-[11px] text-[#96b8dd]">
                {authenticatedStreamer
                  ? `Authenticated as ${authenticatedStreamer}`
                  : 'Authorised Streamer Login Required'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {authenticatedStreamer && (
              <button
                type="button"
                onClick={onStreamerLogout}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-900/60 hover:bg-red-700 text-red-100 flex items-center gap-1 cursor-pointer"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#0c2b53] hover:bg-[#1768b3] text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Gate 1: Require Registered @username + Key before Live Panel opens */}
          {!authenticatedStreamer ? (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#061c3d] border border-[#1768b3] flex items-start gap-3">
                <Lock className="w-5 h-5 text-[#ffe536] shrink-0 mt-0.5" />
                <div className="text-xs text-[#d8eaff] leading-relaxed">
                  Log in with your registered TikTok <strong>@username</strong> and individual Admin-provided key to open the TikTok Live panel and enable the Live Chat box.
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/60 text-red-200 text-xs">
                  {authError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#96b8dd] mb-1">
                  Registered TikTok @Username
                </label>
                <input
                  type="text"
                  value={authUsernameInput}
                  onChange={(e) => setAuthUsernameInput(ensureLeadingAt(e.target.value))}
                  onFocus={() => {
                    if (!authUsernameInput) setAuthUsernameInput('@');
                  }}
                  placeholder="@username"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#020a25] border border-[#1768b3] text-sm text-white focus:outline-none focus:border-[#19e4ff]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#96b8dd] mb-1">
                  Individual Admin-Provided Key
                </label>
                <input
                  type="password"
                  value={authKeyInput}
                  onChange={(e) => setAuthKeyInput(e.target.value)}
                  placeholder="Enter your individual key"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#020a25] border border-[#1768b3] text-sm text-white focus:outline-none focus:border-[#19e4ff]"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-2.5 rounded-xl bg-[#19e4ff] hover:bg-[#5cecff] text-[#020a25] text-xs font-extrabold cursor-pointer"
              >
                {loggingIn ? 'Verifying...' : 'Unlock TikTok Live Panel'}
              </button>
            </form>
          ) : (
            <>
              {/* Live Connection Control & Status Indicator */}
              <div className="p-4 rounded-xl bg-[#061c3d] border border-[#1768b3] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    TikTok Live Stream Connector
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {connectionState === 'connected' && (
                      <span className="text-[#2bff86] flex items-center gap-1">
                        <Wifi className="w-3.5 h-3.5" /> Connected (@{connectedUsername})
                      </span>
                    )}
                    {connectionState === 'connecting' && (
                      <span className="text-[#ffe536] flex items-center gap-1">
                        <Wifi className="w-3.5 h-3.5" /> Connecting...
                      </span>
                    )}
                    {connectionState === 'disconnected' && (
                      <span className="text-[#96b8dd] flex items-center gap-1">
                        <WifiOff className="w-3.5 h-3.5" /> Disconnected
                      </span>
                    )}
                    {connectionState === 'error' && (
                      <span className="text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Error
                      </span>
                    )}
                  </div>
                </div>

                {connectedRoomId && connectionState === 'connected' && (
                  <div className="text-[11px] font-mono text-[#96b8dd]">
                    Room ID: {connectedRoomId}
                  </div>
                )}

                <form onSubmit={handleConnectSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={liveHandleInput}
                    onChange={(e) => setLiveHandleInput(ensureLeadingAt(e.target.value))}
                    placeholder="@username"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#020a25] border border-[#1768b3] text-sm text-white focus:outline-none focus:border-[#19e4ff]"
                  />
                  {connectionState === 'connected' ? (
                    <button
                      type="button"
                      onClick={onDisconnectTikTok}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold cursor-pointer whitespace-nowrap"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={connectionState === 'connecting'}
                      className="px-4 py-2 rounded-xl bg-[#19e4ff] hover:bg-[#5cecff] text-[#020a25] text-xs font-extrabold cursor-pointer whitespace-nowrap"
                    >
                      {connectionState === 'connecting' ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                </form>

                {errorMessage && (
                  <div className="p-2.5 rounded-lg bg-red-950/70 border border-red-500/60 text-red-200 text-xs">
                    {errorMessage}
                  </div>
                )}
              </div>

              {/* Stream Likes & Gifts Telemetry (Kept out of the chat box!) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#061c3d] border border-[#1768b3]/60 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#d8eaff]">
                    <Heart className="w-4 h-4 text-pink-400" />
                    <span>Likes Received</span>
                  </div>
                  <span className="font-mono tabular-nums text-sm font-extrabold text-white">
                    {totalLikesCount.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#061c3d] border border-[#1768b3]/60 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#d8eaff]">
                    <Gift className="w-4 h-4 text-[#ffe536]" />
                    <span>Gifts (Hints)</span>
                  </div>
                  <span className="font-mono tabular-nums text-sm font-extrabold text-[#ffe536]">
                    {totalGiftsCount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Simulate / Debug Panel for Offline Testing */}
              <div className="p-4 rounded-xl bg-[#020a25] border border-[#1768b3] space-y-3">
                <div className="text-xs font-extrabold text-[#ffe536] flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Simulate / Debug Panel (Offline Testing)
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#96b8dd] mb-1">
                      Viewer Display Name
                    </label>
                    <input
                      type="text"
                      value={simNickname}
                      onChange={(e) => setSimNickname(e.target.value)}
                      placeholder="Display Name"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#061c3d] border border-[#1768b3] text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#96b8dd] mb-1">
                      Profile Picture URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={simAvatarUrl}
                      onChange={(e) => setSimAvatarUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#061c3d] border border-[#1768b3] text-xs text-white"
                    />
                  </div>
                </div>

                <form onSubmit={handleFakeChatSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={simComment}
                    onChange={(e) => setSimComment(e.target.value)}
                    placeholder="Fake chat message (multi-word or numbers)..."
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-[#061c3d] border border-[#1768b3] text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-[#2bff86] hover:bg-[#5effa3] text-[#020a25] text-xs font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Send className="w-3 h-3" /> Send Chat
                  </button>
                </form>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleFakeLikeClick}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-pink-600/30 hover:bg-pink-600/50 border border-pink-400/50 text-pink-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5" /> Simulate Like Event
                  </button>
                  <input
                    type="text"
                    value={simGiftName}
                    onChange={(e) => setSimGiftName(e.target.value)}
                    placeholder="Gift Name"
                    className="w-24 px-2.5 py-1.5 rounded-lg bg-[#061c3d] border border-[#1768b3] text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleFakeGiftClick}
                    className="py-1.5 px-3 rounded-lg bg-[#ffe536]/20 hover:bg-[#ffe536]/30 border border-[#ffe536] text-[#ffe536] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Gift className="w-3.5 h-3.5" /> Simulate Gift
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
