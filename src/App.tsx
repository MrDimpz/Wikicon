import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import {
  GameMode,
  RoundState,
  TikTokChatMessage,
  TikTokLikeEvent,
  TikTokGiftEvent,
  UserEconomyProfile,
  ArchivePuzzleItem,
  RankCard,
} from './types';
import { KeycapGrid } from './components/KeycapGrid';
import { TikTokStreamModal } from './components/TikTokStreamModal';
import { AdminModal } from './components/AdminModal';
import { LiveChatBox } from './components/LiveChatBox';
import { WordTycoonHubView } from './components/WordTycoonHubView';
import { soundFX } from './utils/sound';
import {
  Compass,
  Globe,
  Calendar,
  History,
  Sparkles,
  Radio,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Lightbulb,
  Flag,
  RotateCcw,
  Crown,
  Grid,
  Quote,
  Send,
  Coins,
  CheckCircle2,
  Trophy,
} from 'lucide-react';

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes of combined user + chat inactivity

const INITIAL_PROFILE: UserEconomyProfile = {
  username: 'wiki_explorer',
  displayName: 'Wiki Explorer',
  avatar: 'WE',
  coins: 4250,
  elo: 1340,
  xp: 2800,
  level: 5,
  roundsWon: 4,
  totalWordsFound: 68,
  dailyStreak: 3,
  equippedTitle: 'Tycoon Scholar',
  equippedFrame: '#19e4ff',
  equippedTileSkin: 'arcade-teal',
  completedDailies: [],
  businesses: [
    {
      id: 'biz-lexicon',
      name: 'Encyclopedia Printing Press',
      category: 'Publishing',
      level: 2,
      baseCost: 1200,
      coinsPerMinute: 45,
      wordBonusPct: 10,
      description: 'Generates passive coins and increases points for Common & Uncommon discoveries.',
    },
    {
      id: 'biz-semantic',
      name: 'Semantic Vector Observatory',
      category: 'Research AI',
      level: 1,
      baseCost: 2500,
      coinsPerMinute: 95,
      wordBonusPct: 15,
      description: 'Boosts coin rewards for Top-100 Semantic Rank hits and Title Word breakthroughs.',
    },
    {
      id: 'biz-relay',
      name: 'TikTok Stream Relay Studio',
      category: 'Broadcast Media',
      level: 1,
      baseCost: 3800,
      coinsPerMinute: 150,
      wordBonusPct: 20,
      description: 'Amplifies multiplayer crowd rewards when TikTok Live chat solves words together.',
    },
    {
      id: 'biz-keycap',
      name: 'Mechanical Keycap Foundry',
      category: 'Hardware',
      level: 1,
      baseCost: 5000,
      coinsPerMinute: 220,
      wordBonusPct: 25,
      description: 'Increases score multipliers on 8-connected Wikirec Grid & WikiWord Quote target cards.',
    },
  ],
  cosmetics: [
    {
      id: 'cos-title-scholar',
      name: 'Tycoon Scholar',
      slot: 'title',
      price: 0,
      previewHex: '#19e4ff',
      unlocked: true,
      equipped: true,
    },
    {
      id: 'cos-title-oracle',
      name: 'Contexto Grandmaster',
      slot: 'title',
      price: 2500,
      previewHex: '#ffe536',
      unlocked: false,
      equipped: false,
    },
    {
      id: 'cos-title-tiktok',
      name: 'Stream Legend',
      slot: 'title',
      price: 3500,
      previewHex: '#2bff86',
      unlocked: false,
      equipped: false,
    },
    {
      id: 'cos-frame-cyan',
      name: 'Neon Cyan Halo',
      slot: 'frame',
      price: 0,
      previewHex: '#19e4ff',
      unlocked: true,
      equipped: true,
    },
    {
      id: 'cos-frame-gold',
      name: 'Sovereign Gold Crown',
      slot: 'frame',
      price: 4000,
      previewHex: '#ffe536',
      unlocked: false,
      equipped: false,
    },
    {
      id: 'cos-frame-mint',
      name: 'Emerald Matrix Frame',
      slot: 'frame',
      price: 3000,
      previewHex: '#2bff86',
      unlocked: false,
      equipped: false,
    },
  ],
};

export default function App() {
  const [activeNav, setActiveNav] = useState<GameMode>('HOME');
  const [round, setRound] = useState<RoundState | null>(null);
  const [archiveList, setArchiveList] = useState<ArchivePuzzleItem[]>([]);

  // Authorised Streamer Login & TikTok Live Socket.IO State
  const [authenticatedStreamer, setAuthenticatedStreamer] = useState<string | null>(null);
  const [tiktokConnState, setTiktokConnState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectedUsername, setConnectedUsername] = useState<string | null>(null);
  const [connectedRoomId, setConnectedRoomId] = useState<string | null>(null);
  const [tiktokError, setTiktokError] = useState<string | null>(null);

  // Live Chat Messages (Chats only — likes & gifts excluded from chat box)
  const [chatMessages, setChatMessages] = useState<TikTokChatMessage[]>([]);
  const [totalLikesCount, setTotalLikesCount] = useState<number>(0);
  const [totalGiftsCount, setTotalGiftsCount] = useState<number>(0);

  // Modals
  const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // UI Preferences
  const [isLightMode, setIsLightMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showLengthsOnBlocks, setShowLengthsOnBlocks] = useState(false);
  const [guessInput, setGuessInput] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<{
    text: string;
    tone: 'cyan' | 'gold' | 'green' | 'muted';
  } | null>(null);
  const [showGridInHybrid, setShowGridInHybrid] = useState(false);

  const [profile, setProfile] = useState<UserEconomyProfile>(() => {
    try {
      const saved = localStorage.getItem('wk_tycoon_profile_v1');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return INITIAL_PROFILE;
  });

  const socketRef = useRef<Socket | null>(null);
  const prevSolvedRef = useRef<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());
  const topSectionRef = useRef<HTMLDivElement | null>(null);
  const [topSectionHeight, setTopSectionHeight] = useState<number>(424);

  const isTikTokLiveActive = Boolean(
    authenticatedStreamer || tiktokConnState === 'connected'
  );

  // Measure the top section (highlighted yellow in user spec) so the Manuscript Box matches its exact height
  useEffect(() => {
    const el = topSectionRef.current;
    if (!el) return;
    const updateHeight = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 150) {
        setTopSectionHeight(h);
      }
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeNav, round?.roundId, round?.topRankCards?.length, showGridInHybrid]);

  const showToast = useCallback((text: string, tone: 'cyan' | 'gold' | 'green' | 'muted' = 'cyan') => {
    setFeedbackToast({ text, tone });
    setTimeout(() => {
      setFeedbackToast((cur) => (cur?.text === text ? null : cur));
    }, 3200);
  }, []);

  // Touch activity timestamp on any user or chat activity
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Logout helper (used by manual logout, 20-minute inactivity timer, and window close)
  const performStreamerLogout = useCallback(
    (reason?: string) => {
      if (socketRef.current) {
        socketRef.current.emit('streamer-auth-logout');
        socketRef.current.emit('disconnect-tiktok');
      }
      setAuthenticatedStreamer(null);
      setTiktokConnState('disconnected');
      setConnectedUsername(null);
      setConnectedRoomId(null);
      if (reason) {
        showToast(reason, 'muted');
      }
    },
    [showToast]
  );

  // Automatic logout on window close or after 20 minutes of combined user + chat inactivity
  useEffect(() => {
    if (!authenticatedStreamer) return;

    const events = ['pointerdown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    const onUserActivity = () => {
      lastActivityRef.current = Date.now();
    };
    events.forEach((ev) => window.addEventListener(ev, onUserActivity, { passive: true }));

    const handleBeforeUnload = () => {
      if (socketRef.current) {
        socketRef.current.emit('streamer-auth-logout');
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const timer = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
        performStreamerLogout('Logged out due to 20 minutes of user and chat inactivity.');
      }
    }, 10000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onUserActivity));
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(timer);
    };
  }, [authenticatedStreamer, performStreamerLogout]);

  // Sync profile to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wk_tycoon_profile_v1', JSON.stringify(profile));
    } catch (_) {}
  }, [profile]);

  // Passive coin generation from Word Tycoon businesses
  useEffect(() => {
    const interval = setInterval(() => {
      const perMin = profile.businesses.reduce((acc, b) => acc + b.coinsPerMinute * b.level, 0);
      const perTick = perMin / 12;
      setProfile((p) => ({ ...p, coins: p.coins + perTick }));
    }, 5000);
    return () => clearInterval(interval);
  }, [profile.businesses]);

  // Sync light/dark theme with documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (isLightMode) {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [isLightMode]);

  // Connect to backend via Socket.IO & listen for exact TikTok Live events
  useEffect(() => {
    fetch('/api/round')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setRound(data.round);
          if (data.archive) setArchiveList(data.archive);
        }
      })
      .catch(() => {});

    const socket = io();
    socketRef.current = socket;

    socket.on('round:state', (nextRound: RoundState) => {
      setRound(nextRound);
    });

    // Exact Socket.IO listeners specified in prompt
    socket.on('tiktok-connected', (data: { username: string; roomId: string }) => {
      recordActivity();
      setTiktokConnState('connected');
      setConnectedUsername(data.username);
      setConnectedRoomId(data.roomId || null);
      setTiktokError(null);
      showToast(`Connected to TikTok Live @${data.username}`, 'green');
    });

    socket.on('tiktok-error', (errMsg: string) => {
      setTiktokConnState('error');
      setTiktokError(errMsg || 'TikTok connection error');
    });

    socket.on('tiktok-disconnected', () => {
      setTiktokConnState('disconnected');
      setConnectedUsername(null);
      setConnectedRoomId(null);
    });

    socket.on(
      'chat-message',
      (data: {
        uniqueId?: string;
        nickname?: string;
        comment?: string;
        profilePictureUrl?: string;
      }) => {
        recordActivity();
        const msg: TikTokChatMessage = {
          id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          uniqueId: data.uniqueId || 'viewer',
          nickname: data.nickname || data.uniqueId || 'Viewer',
          comment: String(data.comment || ''),
          profilePictureUrl: data.profilePictureUrl || '',
          timestamp: Date.now(),
        };
        // Append all chat messages (even if not part of puzzle, multi-word, or numbers)
        setChatMessages((prev) => [...prev.slice(-199), msg]);
      }
    );

    socket.on('like-event', (data: TikTokLikeEvent) => {
      recordActivity();
      setTotalLikesCount((prev) => prev + (Number(data.likeCount) || 1));
    });

    socket.on('gift-event', (data: TikTokGiftEvent) => {
      recordActivity();
      if (data.repeatEnd === false) return;
      const count = Number(data.repeatCount) || 1;
      setTotalGiftsCount((prev) => prev + count);
      showToast(
        `${data.nickname || 'Viewer'} sent ${count}× ${data.giftName || 'Gift'}! Hint unlocked!`,
        'gold'
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [recordActivity, showToast]);

  // Trigger Victory Fanfare & Confetti when round transitions to solved
  useEffect(() => {
    if (round?.solved && !prevSolvedRef.current) {
      soundFX.playVictoryFanfare();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (_) {}
      setProfile((p) => ({
        ...p,
        coins: p.coins + 2500,
        elo: p.elo + 18,
        roundsWon: p.roundsWon + 1,
        completedDailies:
          round.isDaily && round.dailyDate && !p.completedDailies.includes(round.dailyDate)
            ? [...p.completedDailies, round.dailyDate]
            : p.completedDailies,
      }));
    }
    prevSolvedRef.current = !!round?.solved;
  }, [round?.solved, round?.isDaily, round?.dailyDate]);

  // Streamer login via Socket.IO callback
  const handleStreamerLogin = (
    username: string,
    key: string
  ): Promise<{ ok: boolean; error?: string; username?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ ok: false, error: 'Socket not connected.' });
        return;
      }
      socketRef.current.emit(
        'streamer-auth-login',
        { username, key },
        (resp: { ok: boolean; error?: string; username?: string }) => {
          if (resp.ok && resp.username) {
            recordActivity();
            setAuthenticatedStreamer(resp.username);
            showToast(`Logged in as ${resp.username}. Live Chat box enabled!`, 'green');
          }
          resolve(resp);
        }
      );
    });
  };

  // Emit connect-tiktok / disconnect-tiktok
  const handleConnectTikTok = (username: string) => {
    if (!socketRef.current) return;
    recordActivity();
    setTiktokConnState('connecting');
    setTiktokError(null);
    socketRef.current.emit('connect-tiktok', username);
  };

  const handleDisconnectTikTok = () => {
    if (!socketRef.current) return;
    recordActivity();
    socketRef.current.emit('disconnect-tiktok');
  };

  // Start a specific game mode / puzzle (Does NOT disconnect from TikTok Live between rounds!)
  const startModeRound = async (
    targetNav: GameMode,
    opts: {
      mode: 'WIKICONTEXTO' | 'WIKIREC_GRID' | 'WIKIWORD_QUOTE';
      isDaily?: boolean;
      dailyDate?: string;
      customTitle?: string;
    }
  ) => {
    recordActivity();
    setActiveNav(targetNav);
    setShowGridInHybrid(opts.mode !== 'WIKICONTEXTO');
    try {
      const res = await fetch('/api/round/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      const data = await res.json();
      if (data.ok) {
        setRound(data.round);
        showToast(
          opts.isDaily
            ? `Loaded Daily Discovery (${opts.dailyDate || 'Today'})`
            : `Started new ${opts.mode === 'WIKIREC_GRID' ? 'Wikirec Grid' : opts.mode === 'WIKIWORD_QUOTE' ? 'WikiWord Quote' : 'WikiContexto'} round!`,
          'cyan'
        );
      }
    } catch (_) {}
  };

  // Submit a word guess (only accepts single-word answers including punctuation and numbers)
  const submitWordGuess = async (rawWord: string) => {
    recordActivity();
    const clean = rawWord.trim();
    if (!clean) return;
    if (/\s/.test(clean)) {
      soundFX.playMiss();
      showToast('Only single-word answers (including punctuation & numbers) are accepted.', 'muted');
      return;
    }
    setGuessInput('');

    try {
      const res = await fetch('/api/round/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: clean,
          player: {
            username: profile.username,
            displayName: profile.displayName,
            avatar: profile.displayName.slice(0, 2).toUpperCase(),
            platform: 'web',
            cosmeticTitle: profile.equippedTitle,
          },
        }),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        const r = data.result;
        if (!r.valid) {
          soundFX.playMiss();
          showToast(
            r.reason === 'multi_word'
              ? 'Only single-word answers (including punctuation & numbers) are accepted.'
              : `"${clean.toUpperCase()}" is a pre-revealed common scaffolding word.`,
            'muted'
          );
          return;
        }
        if (r.alreadyRevealed && !r.titleMatched && !r.gridTargetHit) {
          soundFX.playKeycapTap(2);
          showToast(`"${clean.toUpperCase()}" was already discovered (#${r.rank})`, 'muted');
          return;
        }

        const bonusMult =
          1 +
          profile.businesses.reduce((acc, b) => acc + b.wordBonusPct * b.level, 0) / 100;
        const coinReward = Math.max(25, Math.round((r.pointsEarned / 25) * bonusMult));

        if (r.titleMatched) {
          soundFX.playWordHit('TITLE');
          showToast(
            `TITLE WORD: ${clean.toUpperCase()}! +${r.pointsEarned.toLocaleString()} pts`,
            'gold'
          );
        } else if (r.occurrencesRevealed > 0 || r.gridTargetHit) {
          soundFX.playWordHit(r.rarity);
          showToast(
            `Found "${clean.toUpperCase()}" (×${r.occurrencesRevealed} · #${r.rank}) +${r.pointsEarned.toLocaleString()} pts`,
            'green'
          );
        } else {
          soundFX.playKeycapTap(4);
          showToast(
            `Semantic Rank #${r.rank} for "${clean.toUpperCase()}" (${r.similarity}%)`,
            'cyan'
          );
        }

        setProfile((p) => ({
          ...p,
          coins: p.coins + coinReward,
          totalWordsFound:
            r.occurrencesRevealed > 0 || r.gridTargetHit
              ? p.totalWordsFound + 1
              : p.totalWordsFound,
        }));
      }
    } catch (_) {}
  };

  const handleRequestHint = async () => {
    recordActivity();
    try {
      const res = await fetch('/api/round/hint', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        soundFX.playWordHit('UNCOMMON');
        setRound(data.round);
        showToast(
          data.revealedWord
            ? `Hint revealed word: "${data.revealedWord}"`
            : 'Hint revealed a letter in the Target Pyramid!',
          'gold'
        );
      }
    } catch (_) {}
  };

  const handleRevealRound = async () => {
    recordActivity();
    try {
      const res = await fetch('/api/round/reveal', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setRound(data.round);
        showToast(`Article revealed: "${data.round.articleTitle}"`, 'gold');
      }
    } catch (_) {}
  };

  const handleUpgradeBusiness = (businessId: string) => {
    recordActivity();
    setProfile((prev) => {
      const target = prev.businesses.find((b) => b.id === businessId);
      if (!target) return prev;
      const cost = Math.round(target.baseCost * Math.pow(1.45, target.level));
      if (prev.coins < cost) return prev;
      soundFX.playWordHit('RARE');
      return {
        ...prev,
        coins: prev.coins - cost,
        level: prev.level + 1,
        businesses: prev.businesses.map((b) =>
          b.id === businessId ? { ...b, level: b.level + 1 } : b
        ),
      };
    });
  };

  const handleBuyOrEquipCosmetic = (cosmeticId: string) => {
    recordActivity();
    setProfile((prev) => {
      const target = prev.cosmetics.find((c) => c.id === cosmeticId);
      if (!target) return prev;
      if (!target.unlocked && prev.coins < target.price) return prev;
      soundFX.playWordHit('UNCOMMON');
      const nextCoins = target.unlocked ? prev.coins : prev.coins - target.price;
      const nextCosmetics = prev.cosmetics.map((c) => {
        if (c.id === cosmeticId) {
          return { ...c, unlocked: true, equipped: true };
        }
        if (c.slot === target.slot) {
          return { ...c, equipped: false };
        }
        return c;
      });
      return {
        ...prev,
        coins: nextCoins,
        equippedTitle: target.slot === 'title' ? target.name : prev.equippedTitle,
        equippedFrame: target.slot === 'frame' ? target.previewHex : prev.equippedFrame,
        cosmetics: nextCosmetics,
      };
    });
  };

  const getRankHue = (rank: number) => {
    if (rank <= 10) return 135;
    if (rank <= 100) return 110;
    if (rank <= 400) return 52;
    if (rank <= 1200) return 32;
    return 202;
  };

  const paddedRankCards: (RankCard | null)[] = Array.from({ length: 6 }, (_, i) =>
    round && round.topRankCards[i] ? round.topRankCards[i] : null
  );

  const goldPlayer = round?.leaderboard[0] || null;
  const silverPlayer = round?.leaderboard[1] || null;
  const bronzePlayer = round?.leaderboard[2] || null;

  const renderPlayerAvatar = (
    avatarUrlOrInitials: string | undefined,
    displayName: string,
    sizeClasses: string,
    borderClasses: string
  ) => {
    const initials = (displayName || 'VW').slice(0, 2).toUpperCase();
    if (avatarUrlOrInitials && avatarUrlOrInitials.startsWith('http')) {
      return (
        <img
          src={avatarUrlOrInitials}
          alt={displayName}
          referrerPolicy="no-referrer"
          className={`${sizeClasses} rounded-full object-cover ${borderClasses}`}
        />
      );
    }
    return (
      <div
        className={`${sizeClasses} rounded-full bg-[#03142f] ${borderClasses} flex items-center justify-center font-extrabold`}
      >
        {initials}
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center transition-colors duration-200 ${
        isLightMode
          ? 'wk-canvas-light text-[#102c4b]'
          : 'wk-canvas-dark text-[#f3f8ff]'
      }`}
    >
      {/* ── Horizontal Flex Wrapper: Live Chat Box on Left (Only when Authorised User Logged In) + 50px Gap + 490px Game Shell ── */}
      <div className="w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-[50px] px-4">
        {/* Live Chat Stream Box to the left of the game with 50px gap — ONLY shown if an authorised user logs in */}
        {authenticatedStreamer && (
          <div className="pt-4">
            <LiveChatBox
              messages={chatMessages}
              connectedUsername={connectedUsername || authenticatedStreamer}
              isLightMode={isLightMode}
            />
          </div>
        )}

        {/* ── Centered 490px App Shell ── */}
        <div className="w-full max-w-[490px] min-h-screen flex flex-col shrink-0">
          {/* ── Top Navigation Bar (490px width, includes Admin link & TikTok Live login gate) ── */}
          <header
            className={`w-full flex items-center justify-between gap-2 px-3.5 py-3 border-b ${
              isLightMode
                ? 'bg-white/85 border-[#6498d2]/40'
                : 'bg-[#020a25]/90 border-[#1768b3]/50'
            } backdrop-blur-md sticky top-0 z-30`}
          >
            {/* Zone 1: Brand Wordmark */}
            <button
              type="button"
              onClick={() => setActiveNav('HOME')}
              className="text-base font-extrabold tracking-tight whitespace-nowrap shrink-0 cursor-pointer text-left"
            >
              Wiki<span className="text-[#19e4ff]">Contexto</span>
            </button>

            {/* Zone 2: Navigation Links (Home Hub, WikiContexto, Past Dailies, Admin) */}
            <nav className="flex items-center gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveNav('HOME')}
                className={`hover:text-[#19e4ff] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeNav === 'HOME'
                    ? 'text-[#19e4ff] underline underline-offset-8 decoration-2'
                    : isLightMode
                    ? 'text-[#163a61]'
                    : 'text-[#d8eaff]'
                }`}
              >
                Home Hub
              </button>
              <button
                type="button"
                onClick={() =>
                  startModeRound('DAILY', {
                    mode: 'WIKICONTEXTO',
                    isDaily: true,
                    dailyDate: '2026-10-31',
                  })
                }
                className={`hover:text-[#19e4ff] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeNav === 'DAILY' ||
                  activeNav === 'SOLO' ||
                  activeNav === 'ONLINE' ||
                  activeNav === 'WIKIREC_GRID' ||
                  activeNav === 'WIKIWORD_QUOTE'
                    ? 'text-[#19e4ff] underline underline-offset-8 decoration-2'
                    : isLightMode
                    ? 'text-[#163a61]'
                    : 'text-[#d8eaff]'
                }`}
              >
                WikiContexto
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('ARCHIVE')}
                className={`hover:text-[#19e4ff] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeNav === 'ARCHIVE'
                    ? 'text-[#19e4ff] underline underline-offset-8 decoration-2'
                    : isLightMode
                    ? 'text-[#163a61]'
                    : 'text-[#d8eaff]'
                }`}
              >
                Past Dailies
              </button>
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className={`hover:text-[#ffe536] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isLightMode ? 'text-[#163a61]' : 'text-[#d8eaff]'
                }`}
              >
                Admin
              </button>
            </nav>

            {/* Zone 3: TikTok Live Button (Requires login with registered @username & key before panel opens) */}
            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setIsStreamModalOpen(true)}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  tiktokConnState === 'connected'
                    ? 'bg-[#2bff86] text-[#020a25] shadow-[0_0_16px_rgba(43,255,134,0.35)]'
                    : authenticatedStreamer
                    ? 'bg-[#ffe536] text-[#020a25]'
                    : 'bg-[#19e4ff] hover:bg-[#5cecff] text-[#020a25] shadow-[0_0_14px_rgba(25,228,255,0.28)]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                {tiktokConnState === 'connected' && connectedUsername
                  ? `@${connectedUsername}`
                  : authenticatedStreamer
                  ? authenticatedStreamer
                  : 'TikTok Live'}
              </button>
            </div>
          </header>

          {/* ── VIEW 1: WIKICONTEXTO 6-BUBBLE HOME PORTAL (490px width) ── */}
          {activeNav === 'HOME' && (
            <main className="flex-1 w-full px-4 py-6 flex flex-col justify-between">
              {/* Suite Top Subbar */}
              <div className="flex items-center justify-between text-[11px] text-[#96b8dd] gap-2">
                <button
                  type="button"
                  onClick={() => setActiveNav('TYCOON_HUB')}
                  className="flex items-center gap-1.5 font-bold text-[#f3f8ff] hover:text-[#19e4ff] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Coins className="w-3.5 h-3.5 text-[#ffe536]" />
                  <span>Word Tycoon · {Math.floor(profile.coins).toLocaleString()} Coins</span>
                </button>
                <span className="truncate font-mono tabular-nums">
                  {profile.displayName} · ELO {profile.elo}
                </span>
              </div>

              {/* Center Wordmark & Tagline */}
              <section className="my-6 text-center">
                <div className="inline-flex items-center justify-center gap-2.5 mb-1.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#19e4ff] to-[#137bcc] flex items-center justify-center shadow-[0_0_20px_rgba(25,228,255,0.4)] text-[#020a25] font-black text-xl">
                    W
                  </div>
                  <h1
                    className="text-3xl font-black tracking-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    Wiki<span className="text-[#19e4ff]">Contexto</span>{' '}
                    <span className="text-base font-bold text-[#ffe536]">× Wikirec</span>
                  </h1>
                </div>
                <p className="text-xs text-[#96b8dd] mt-1.5 leading-relaxed">
                  One hidden Wikipedia article. Semantic rank cards, 8-connected arcade keycaps, and live TikTok stream play.
                </p>
              </section>

              {/* Authentic 2×3 Bubble Grid Menu inside 490px */}
              <nav
                aria-label="WikiContexto menu"
                className="grid grid-cols-2 gap-3.5 my-2"
              >
                {/* Bubble 1: Solo */}
                <button
                  type="button"
                  onClick={() =>
                    startModeRound('SOLO', {
                      mode: 'WIKICONTEXTO',
                      isDaily: false,
                    })
                  }
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#06244b] to-[#03142f] border-2 border-[#19e4ff]/70 hover:border-[#19e4ff] shadow-[0_0_20px_rgba(25,228,255,0.15)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#19e4ff]/15 text-[#19e4ff] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Compass className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Solo
                  </span>
                  <span className="text-[11px] text-[#96b8dd]">
                    Explore random articles
                  </span>
                </button>

                {/* Bubble 2: Online + TikTok Stream */}
                <button
                  type="button"
                  onClick={() => {
                    startModeRound('ONLINE', {
                      mode: 'WIKICONTEXTO',
                      isDaily: false,
                    });
                    if (!authenticatedStreamer) {
                      setIsStreamModalOpen(true);
                    }
                  }}
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#06244b] to-[#03142f] border-2 border-[#2bff86]/70 hover:border-[#2bff86] shadow-[0_0_20px_rgba(43,255,134,0.15)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#2bff86]/15 text-[#2bff86] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Globe className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Online &amp; TikTok
                  </span>
                  <span className="text-[11px] text-[#96b8dd]">
                    Discover together live
                  </span>
                </button>

                {/* Bubble 3: Daily Puzzle */}
                <button
                  type="button"
                  onClick={() =>
                    startModeRound('DAILY', {
                      mode: 'WIKICONTEXTO',
                      isDaily: true,
                      dailyDate: '2026-10-31',
                    })
                  }
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#2b1f06] via-[#06244b] to-[#03142f] border-2 border-[#ffe536] shadow-[0_0_22px_rgba(255,229,54,0.2)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#ffe536]/20 text-[#ffe536] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-[#ffe536] whitespace-nowrap">
                    Daily Puzzle
                  </span>
                  <span className="text-[11px] text-[#d8eaff]">
                    Oct 31 Discovery
                  </span>
                </button>

                {/* Bubble 4: Wikirec Keycap Grid */}
                <button
                  type="button"
                  onClick={() =>
                    startModeRound('WIKIREC_GRID', {
                      mode: 'WIKIREC_GRID',
                      isDaily: false,
                    })
                  }
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#1b3346] to-[#0a1620] border-2 border-[#ee7a2c] shadow-[0_0_20px_rgba(238,122,44,0.2)] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#ee7a2c]/20 text-[#ee7a2c] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Grid className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Wikirec Grid
                  </span>
                  <span className="text-[11px] text-[#96b8dd]">
                    7×7 Keycaps &amp; Pyramid
                  </span>
                </button>

                {/* Bubble 5: Previous Dailies Archive */}
                <button
                  type="button"
                  onClick={() => setActiveNav('ARCHIVE')}
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#06244b] to-[#03142f] border-2 border-[#137bcc] hover:border-[#19e4ff] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#137bcc]/25 text-[#96b8dd] group-hover:text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                    <History className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Previous Dailies
                  </span>
                  <span className="text-[11px] text-[#96b8dd]">
                    Revisit past puzzles
                  </span>
                </button>

                {/* Bubble 6: Profile & Cosmetics (Word Tycoon Hub) */}
                <button
                  type="button"
                  onClick={() => setActiveNav('TYCOON_HUB')}
                  className="group relative p-4 rounded-3xl bg-gradient-to-br from-[#270e28] to-[#03142f] border-2 border-[#d557a7] hover:border-[#ff8cd6] transition-all flex flex-col items-center text-center gap-1.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#d557a7]/20 text-[#ff8cd6] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-extrabold text-white whitespace-nowrap">
                    Profile &amp; Tycoon
                  </span>
                  <span className="text-[11px] text-[#96b8dd]">
                    Cosmetics &amp; Empire
                  </span>
                </button>
              </nav>

              {/* Footer */}
              <footer className="mt-6 pt-3.5 border-t border-[#1768b3]/30 flex items-center justify-between text-[11px] text-[#96b8dd]">
                <span>Pick a bubble. Follow your curiosity.</span>
                <button
                  type="button"
                  onClick={() =>
                    startModeRound('WIKIWORD_QUOTE', {
                      mode: 'WIKIWORD_QUOTE',
                      isDaily: false,
                    })
                  }
                  className="hover:text-[#19e4ff] transition-colors cursor-pointer whitespace-nowrap"
                >
                  WikiWord 5×7 →
                </button>
              </footer>
            </main>
          )}

          {/* ── VIEW 2: PREVIOUS DAILIES ARCHIVE (490px width) ── */}
          {activeNav === 'ARCHIVE' && (
            <main className="flex-1 w-full px-4 py-6 space-y-4">
              <div>
                <h1 className="text-xl font-extrabold">Previous Daily Discoveries</h1>
                <p className="text-xs text-[#96b8dd] mt-1">
                  Play any archived Wikipedia article in WikiContexto or Wikirec Keycap Grid Mode.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {archiveList.map((item) => {
                  const isDone = profile.completedDailies.includes(item.date);
                  return (
                    <div
                      key={item.date}
                      className="p-4 rounded-2xl bg-[#061c3d] border-2 border-[#137bcc] flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-[#96b8dd]">
                          <span className="font-mono tabular-nums">{item.date} · {item.difficulty}</span>
                          {isDone && (
                            <span className="text-[#2bff86] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Solved
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-extrabold text-white mt-0.5">
                          {item.category}
                        </h3>
                        <p className="text-[11px] text-[#96b8dd] mt-0.5 font-mono tabular-nums">
                          Approx. {item.wordCount} tokens · Hidden Wikipedia Article
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            startModeRound('DAILY', {
                              mode: 'WIKICONTEXTO',
                              isDaily: true,
                              dailyDate: item.date,
                              customTitle: item.title,
                            })
                          }
                          className="flex-1 py-2 px-3 rounded-xl bg-[#19e4ff] hover:bg-[#5cecff] text-[#020a25] text-xs font-bold cursor-pointer whitespace-nowrap"
                        >
                          Play WikiContexto
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            startModeRound('WIKIREC_GRID', {
                              mode: 'WIKIREC_GRID',
                              isDaily: true,
                              dailyDate: item.date,
                              customTitle: item.title,
                            })
                          }
                          className="flex-1 py-2 px-3 rounded-xl bg-[#0c2b53] hover:bg-[#1768b3] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                        >
                          Play Wikirec Grid
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </main>
          )}

          {/* ── VIEW 3: WORD TYCOON ECONOMY & COSMETICS HUB (490px width) ── */}
          {activeNav === 'TYCOON_HUB' && (
            <main className="flex-1 w-full">
              <WordTycoonHubView
                profile={profile}
                onUpgradeBusiness={handleUpgradeBusiness}
                onBuyOrEquipCosmetic={handleBuyOrEquipCosmetic}
                onRenameUser={(newName) =>
                  setProfile((p) => ({
                    ...p,
                    displayName: newName,
                    avatar: newName.slice(0, 2).toUpperCase(),
                  }))
                }
              />
            </main>
          )}

          {/* ── VIEW 4: ACTIVE GAMEPLAY ARENA (490px Portrait Width) ── */}
          {(activeNav === 'DAILY' ||
            activeNav === 'SOLO' ||
            activeNav === 'ONLINE' ||
            activeNav === 'WIKIREC_GRID' ||
            activeNav === 'WIKIWORD_QUOTE') &&
            round && (
              <main className="flex-1 w-full px-3.5 py-4 space-y-3">
                {/* ── Top Section (Toolbar + 2-Column Title/Podium/Ranks + Announce Banner) ── */}
                <div ref={topSectionRef} className="space-y-3">
                {/* Compact Workspace Mode & Utility Toolbar */}
                <div className="flex flex-col gap-2 p-2.5 rounded-2xl bg-[#03142f]/90 border border-[#1768b3]">
                  {/* Row 1: Mode Switcher Tabs */}
                  <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#020a25]">
                    <button
                      type="button"
                      onClick={() =>
                        startModeRound('DAILY', {
                          mode: 'WIKICONTEXTO',
                          isDaily: true,
                          dailyDate: '2026-10-31',
                        })
                      }
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate ${
                        activeNav === 'DAILY'
                          ? 'bg-[#19e4ff] text-[#020a25]'
                          : 'text-[#96b8dd] hover:text-white'
                      }`}
                    >
                      Daily
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startModeRound('SOLO', {
                          mode: 'WIKICONTEXTO',
                          isDaily: false,
                        })
                      }
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate ${
                        activeNav === 'SOLO'
                          ? 'bg-[#19e4ff] text-[#020a25]'
                          : 'text-[#96b8dd] hover:text-white'
                      }`}
                    >
                      Solo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startModeRound('WIKIREC_GRID', {
                          mode: 'WIKIREC_GRID',
                          isDaily: false,
                        })
                      }
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate flex items-center justify-center gap-1 ${
                        activeNav === 'WIKIREC_GRID'
                          ? 'bg-[#ee7a2c] text-white'
                          : 'text-[#96b8dd] hover:text-white'
                      }`}
                    >
                      <Grid className="w-3 h-3 shrink-0" /> 7×7 Grid
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startModeRound('WIKIWORD_QUOTE', {
                          mode: 'WIKIWORD_QUOTE',
                          isDaily: false,
                        })
                      }
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate flex items-center justify-center gap-1 ${
                        activeNav === 'WIKIWORD_QUOTE'
                          ? 'bg-[#2bff86] text-[#020a25]'
                          : 'text-[#96b8dd] hover:text-white'
                      }`}
                    >
                      <Quote className="w-3 h-3 shrink-0" /> 5×7 Quote
                    </button>
                  </div>

                  {/* Row 2: Game Utilities */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowGridInHybrid((v) => !v)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                          showGridInHybrid
                            ? 'bg-[#ee7a2c]/20 border-[#ee7a2c] text-[#ee7a2c]'
                            : 'bg-[#061c3d] border-[#1768b3] text-[#d8eaff]'
                        }`}
                      >
                        {showGridInHybrid ? 'Hide Grid' : 'Show Grid'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLengthsOnBlocks((v) => !v)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                          showLengthsOnBlocks
                            ? 'bg-[#19e4ff]/20 border-[#19e4ff] text-[#19e4ff]'
                            : 'bg-[#061c3d] border-[#1768b3] text-[#d8eaff]'
                        }`}
                      >
                        {showLengthsOnBlocks ? 'Hide Lengths' : 'Lengths'}
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestHint}
                        disabled={round.solved}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#061c3d] hover:bg-[#0c2b53] border border-[#ffe536]/60 text-[#ffe536] flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-40"
                      >
                        <Lightbulb className="w-3 h-3" /> Hint
                      </button>
                      <button
                        type="button"
                        onClick={handleRevealRound}
                        disabled={round.solved}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#061c3d] hover:bg-[#0c2b53] border border-[#1768b3] text-[#96b8dd] hover:text-white flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-40"
                      >
                        <Flag className="w-3 h-3" /> Reveal
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const nextMute = !isMuted;
                          setIsMuted(nextMute);
                          soundFX.muted = nextMute;
                        }}
                        aria-label="Toggle Sound"
                        className="p-1.5 rounded-lg bg-[#061c3d] border border-[#1768b3] text-[#d8eaff] hover:text-white cursor-pointer"
                      >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsLightMode((v) => !v)}
                        aria-label="Toggle Light/Dark Theme"
                        className="p-1.5 rounded-lg bg-[#061c3d] border border-[#1768b3] text-[#d8eaff] hover:text-white cursor-pointer"
                      >
                        {isLightMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Round Complete Overlay Card (Shows Top Player Profile Picture, Display Name, and Score + Current Article Info) ── */}
                {round.solved && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0b4937] via-[#06244b] to-[#0b4937] border-2 border-[#2bff86] shadow-[0_0_24px_rgba(43,255,134,0.3)] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold text-[#2bff86]">
                          ROUND COMPLETE · {round.articleCategory}
                        </div>
                        <h2 className="text-xl font-black text-white">
                          {round.articleTitle}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          startModeRound(activeNav, {
                            mode: round.mode,
                            isDaily: false,
                          })
                        }
                        className="px-3.5 py-2 rounded-xl bg-[#2bff86] hover:bg-[#5effa3] text-[#020a25] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Next Round
                      </button>
                    </div>

                    {round.articleSummaryQuote && (
                      <p className="text-xs text-[#d8eaff]">
                        {round.articleSummaryQuote}
                      </p>
                    )}

                    {/* Top Player MVP Highlight on Round Complete Overlay */}
                    <div className="p-3 rounded-xl bg-[#020a25]/75 border border-[#ffe536]/60 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <Crown className="w-4 h-4 text-[#ffe536] absolute -top-2.5 -left-1 -rotate-12" />
                          {renderPlayerAvatar(
                            goldPlayer?.avatar,
                            goldPlayer?.displayName || profile.displayName,
                            'w-11 h-11 text-xs text-[#ffe536]',
                            'border-2 border-[#ffe536]'
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-[#ffe536] flex items-center gap-1">
                            <Trophy className="w-3 h-3" /> TOP PLAYER OF THE ROUND
                          </div>
                          <div className="text-sm font-extrabold text-white truncate">
                            {goldPlayer ? goldPlayer.displayName : profile.displayName}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-[#96b8dd]">Top Score</div>
                        <div className="text-base font-extrabold font-mono tabular-nums text-[#2bff86]">
                          {(goldPlayer ? goldPlayer.score : 0).toLocaleString()} pts
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Authentic WikiContexto 2-Column Top Row Fitted to 490px Portrait Canvas ── */}
                {activeNav !== 'WIKIWORD_QUOTE' && (
                  <section className="grid grid-cols-12 gap-2.5 items-stretch">
                    {/* Left Column (5 cols): Title Block + Podium */}
                    <div className="col-span-5 flex flex-col gap-2.5">
                      {/* Title Block */}
                      <div className="flex-1 p-3 rounded-2xl bg-gradient-to-br from-[#06244b] to-[#03142f] border-2 border-[#137bcc] shadow-[inset_0_1px_7px_rgba(25,228,255,0.16)] flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="text-[10px] font-bold tracking-wider text-[#96b8dd]">
                            TITLE
                          </span>
                          <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums text-[#d8eaff]">
                            <span className="flex items-center gap-0.5">
                              <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-b from-[#ffec4a] to-[#ffad13] text-[#17210a] font-black text-[9px] inline-flex items-center justify-center">
                                G
                              </span>
                              {round.guessCount}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-b from-[#ffec4a] to-[#ffad13] text-[#17210a] font-black text-[9px] inline-flex items-center justify-center">
                                F
                              </span>
                              {round.revealedWordsCount}/{round.totalWords}
                            </span>
                          </div>
                        </div>

                        {/* Title Word Slots */}
                        <div className="flex flex-wrap items-center gap-1.5 my-1">
                          {round.titleTokens.map((t) => (
                            <div
                              key={t.index}
                              className={`min-h-[32px] px-2.5 py-1 rounded-xl font-extrabold text-sm flex items-center gap-1 transition-all ${
                                t.revealed
                                  ? 'bg-gradient-to-br from-[#64ff54] to-[#22ed3f] text-[#061d0c] shadow-[0_0_12px_rgba(57,255,99,0.3)]'
                                  : 'bg-gradient-to-br from-[#fff780] to-[#ffcf27] text-[#111809] border border-[#ffef86]'
                              }`}
                            >
                              <span className="truncate max-w-[140px]">
                                {t.revealed
                                  ? t.text
                                  : showLengthsOnBlocks
                                  ? `${t.length}L`
                                  : 'HIDDEN'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Gold / Silver / Bronze Scoreboard Podium */}
                      <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#06244b] to-[#03142f] border-2 border-[#137bcc] flex items-end justify-center gap-1.5 min-h-[118px]">
                        {/* Silver #2 */}
                        <div
                          className={`flex-1 min-w-0 h-22 rounded-xl border border-[#8ab9f5] bg-gradient-to-br from-[#a5cbec]/25 to-[#0d3470] p-1.5 flex flex-col items-center justify-between text-center ${
                            !silverPlayer ? 'opacity-40' : ''
                          }`}
                        >
                          {renderPlayerAvatar(
                            silverPlayer?.avatar,
                            silverPlayer?.displayName || '2',
                            'w-7 h-7 text-[10px] text-white',
                            'border border-[#8ab9f5]'
                          )}
                          <div className="text-[9px] font-bold text-[#e6f2ff] truncate w-full">
                            {silverPlayer ? silverPlayer.displayName : '—'}
                          </div>
                          <div className="text-[9px] font-mono tabular-nums text-white font-bold">
                            {silverPlayer ? silverPlayer.score.toLocaleString() : '0'}
                          </div>
                        </div>

                        {/* Gold #1 */}
                        <div
                          className={`relative flex-1 min-w-0 h-25 rounded-xl border-2 border-[#ffdd35] bg-gradient-to-br from-[#700432] to-[#270e28] shadow-[0_0_12px_rgba(255,214,48,0.3)] p-1.5 flex flex-col items-center justify-between text-center ${
                            !goldPlayer ? 'opacity-45' : ''
                          }`}
                        >
                          <Crown className="w-4 h-4 text-[#ffe536] absolute -top-2.5 -left-1 -rotate-12" />
                          {renderPlayerAvatar(
                            goldPlayer?.avatar,
                            goldPlayer?.displayName || '1',
                            'w-8 h-8 text-[11px] text-[#ffe536]',
                            'border border-[#ffe536]'
                          )}
                          <div className="text-[10px] font-extrabold text-[#ffe536] truncate w-full">
                            {goldPlayer ? goldPlayer.displayName : '—'}
                          </div>
                          <div className="text-[9px] font-mono tabular-nums text-white font-bold">
                            {goldPlayer ? goldPlayer.score.toLocaleString() : '0'}
                          </div>
                        </div>

                        {/* Bronze #3 */}
                        <div
                          className={`flex-1 min-w-0 h-20 rounded-xl border border-[#b07a3d] bg-gradient-to-br from-[#183553] to-[#020c22] p-1.5 flex flex-col items-center justify-between text-center ${
                            !bronzePlayer ? 'opacity-40' : ''
                          }`}
                        >
                          {renderPlayerAvatar(
                            bronzePlayer?.avatar,
                            bronzePlayer?.displayName || '3',
                            'w-6 h-6 text-[9px] text-white',
                            'border border-[#b07a3d]'
                          )}
                          <div className="text-[9px] font-bold text-[#e6f2ff] truncate w-full">
                            {bronzePlayer ? bronzePlayer.displayName : '—'}
                          </div>
                          <div className="text-[9px] font-mono tabular-nums text-white font-bold">
                            {bronzePlayer ? bronzePlayer.score.toLocaleString() : '0'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column (7 cols): Top-6 Semantic Rank Cards Stack */}
                    <div className="col-span-7 grid grid-rows-6 gap-1.5 min-h-[268px]">
                      {paddedRankCards.map((card, idx) => {
                        if (!card) {
                          return (
                            <div
                              key={`empty-${idx}`}
                              className="rounded-xl bg-[#051630]/70 border border-[#21558a]/60 px-3 flex items-center justify-between text-[11px] text-[#96b8dd]/60"
                            >
                              <span>Rank #{idx + 1}</span>
                              <span className="font-mono tabular-nums">—</span>
                            </div>
                          );
                        }

                        const hue = getRankHue(card.rank);
                        const fillWidth = Math.max(18, card.similarity);

                        return (
                          <div
                            key={card.norm}
                            className="relative rounded-xl bg-[#02112a] overflow-hidden flex items-center justify-between px-2.5 py-1.5"
                            style={{
                              border: `2px solid hsl(${hue}, 90%, 55%)`,
                              boxShadow:
                                idx === 0
                                  ? `0 0 12px hsla(${hue}, 90%, 55%, 0.35)`
                                  : `0 0 5px hsla(${hue}, 90%, 55%, 0.2)`,
                            }}
                          >
                            {/* Dynamic HSL Semantic Fill Bar */}
                            <div
                              className="absolute inset-y-0 left-0 pointer-events-none transition-all duration-300"
                              style={{
                                width: `${fillWidth}%`,
                                background: `linear-gradient(90deg, hsla(${hue}, 90%, 50%, 0.52) 0%, hsla(${hue}, 85%, 42%, 0.25) 65%, transparent 100%)`,
                              }}
                            />

                            {/* Left: Rank Number + Word */}
                            <div className="relative z-10 flex items-center gap-1.5 min-w-0">
                              <span className="min-w-[44px] font-mono tabular-nums text-xs font-extrabold text-white flex items-center gap-0.5">
                                {idx === 0 && <span className="text-[#ffe536]">♛</span>}#{card.rank}
                              </span>
                              <span className="text-sm font-extrabold text-white tracking-wide truncate">
                                {card.word}
                              </span>
                            </div>

                            {/* Right: Finder Avatar */}
                            <div className="relative z-10 flex items-center gap-1.5 shrink-0">
                              {renderPlayerAvatar(
                                card.finder.avatar,
                                card.finder.displayName,
                                'w-6 h-6 text-[10px] text-white',
                                'border border-[#ffe536]'
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* ── Full-Width Word Announce Banner + Feedback Toast ── */}
                <div className="min-h-[46px] rounded-2xl border-2 border-[#ffe13a] bg-gradient-to-r from-[#4b003e] via-[#100621] to-[#25082e] shadow-[0_0_12px_rgba(255,222,53,0.22)] px-3.5 py-2 flex items-center justify-between gap-2">
                  {feedbackToast ? (
                    <div className="flex items-center justify-between w-full text-xs font-bold gap-2">
                      <span
                        className={`truncate ${
                          feedbackToast.tone === 'gold'
                            ? 'text-[#ffe536]'
                            : feedbackToast.tone === 'green'
                            ? 'text-[#2bff86]'
                            : feedbackToast.tone === 'cyan'
                            ? 'text-[#19e4ff]'
                            : 'text-[#d8eaff]'
                        }`}
                      >
                        {feedbackToast.text}
                      </span>
                      <span className="text-[10px] text-[#96b8dd] font-mono tabular-nums shrink-0">
                        #{round.guessCount}
                      </span>
                    </div>
                  ) : round.lastAnnouncement ? (
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {renderPlayerAvatar(
                          round.lastAnnouncement.avatar,
                          round.lastAnnouncement.displayName,
                          'w-7 h-7 text-[10px] text-[#ffe536] shrink-0',
                          'border border-[#ffe536]'
                        )}
                        <div className="text-xs text-[#d8eaff] truncate">
                          <strong className="text-white">{round.lastAnnouncement.displayName}</strong>{' '}
                          found <strong className="text-[#ffe536]">{round.lastAnnouncement.word}</strong>
                        </div>
                      </div>
                      <div className="text-xs font-extrabold font-mono tabular-nums text-[#2bff86] shrink-0">
                        +{round.lastAnnouncement.pointsEarned.toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full text-[11px] text-[#d8eaff]">
                      <span className="truncate">
                        {isTikTokLiveActive
                          ? 'TikTok Live active! Viewers guess single words in chat!'
                          : 'Guess single words below to uncover the hidden article!'}
                      </span>
                      <span className="font-mono tabular-nums text-[#ffe536] shrink-0">
                        +50k Title
                      </span>
                    </div>
                  )}
                </div>
                </div>

                {/* ── Horizontal Guess Ticker ── */}
                {round.recentTicker.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-2.5 rounded-xl bg-[#03142f]/80 border border-[#1768b3]/50">
                    <span className="text-[10px] font-bold text-[#96b8dd] shrink-0">
                      Recent:
                    </span>
                    {round.recentTicker.map((item) => (
                      <span
                        key={`${item.norm}-${item.timestamp}`}
                        className="text-[11px] font-mono tabular-nums whitespace-nowrap shrink-0 text-[#d8eaff]"
                      >
                        <strong className="text-white">{item.word}</strong>{' '}
                        <span className="text-[#19e4ff]">#{item.rank}</span>
                        <span className="mx-1 text-[#1768b3]">·</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* ── Guess Composer Input Bar (Removed when TikTok Live is connected) ── */}
                {!isTikTokLiveActive && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitWordGuess(guessInput);
                    }}
                    className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#03142f] border-2 border-[#2186c6] shadow-[0_0_16px_rgba(19,132,211,0.2)]"
                  >
                    <input
                      type="text"
                      value={guessInput}
                      onChange={(e) => setGuessInput(e.target.value)}
                      placeholder="Guess a single word..."
                      className="flex-1 min-w-0 px-3.5 py-2 rounded-xl bg-[#020a25] border border-[#286296] text-sm font-bold text-white placeholder-[#96b8dd]/60 focus:outline-none focus:border-[#19e4ff]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-gradient-to-b from-[#ffed60] to-[#ffca27] hover:from-[#fff380] hover:to-[#ffd645] text-[#17210a] font-extrabold text-xs border border-[#ffed6c] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" /> Guess
                    </button>
                  </form>
                )}

                {/* ── Wikirec 8-Connected Keycap Grid & Target Pyramid ── */}
                {(activeNav === 'WIKIREC_GRID' ||
                  activeNav === 'WIKIWORD_QUOTE' ||
                  showGridInHybrid) &&
                  round.gridBoard && (
                    <section className="p-3.5 rounded-2xl bg-gradient-to-br from-[#06244b] to-[#03142f] border-2 border-[#137bcc]">
                      <KeycapGrid
                        gridBoard={round.gridBoard}
                        onWordSubmit={submitWordGuess}
                        isLightMode={isLightMode}
                      />
                    </section>
                  )}

                {/* ── Condensed Redacted Wikipedia Manuscript Box (Same Height as Top Section + Scrollbar) ── */}
                <section
                  className={`p-4 rounded-2xl border-2 border-[#137bcc] shadow-[inset_0_1px_7px_rgba(25,228,255,0.15)] flex flex-col overflow-hidden ${
                    isLightMode
                      ? 'bg-white text-[#102c4b]'
                      : 'bg-gradient-to-br from-[#06244b] to-[#03142f] text-[#f3f8ff]'
                  }`}
                  style={{
                    fontFamily: 'var(--font-article)',
                    height: `${topSectionHeight}px`,
                  }}
                >
                  <div className="flex items-center justify-between border-b border-[#1768b3]/40 pb-2 mb-3 text-[11px] text-[#96b8dd] shrink-0">
                    <span>Wikipedia Redacted Manuscript</span>
                    <span className="font-mono tabular-nums">
                      {Math.round((round.revealedWordsCount / Math.max(1, round.totalWords)) * 100)}% Uncovered
                    </span>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-3.5 leading-7 text-[15px] wk-manuscript-scroll">
                    {round.paragraphs.map((para, pIdx) => (
                      <p key={pIdx} className="break-words">
                        {para.map((tok) => {
                          if (tok.type === 'space') {
                            return <span key={tok.id}>{tok.text}</span>;
                          }
                          if (tok.revealed) {
                            return (
                              <span
                                key={tok.id}
                                className={`font-semibold transition-colors ${
                                  tok.isStop
                                    ? isLightMode
                                      ? 'text-[#416890]'
                                      : 'text-[#d8eaff]'
                                    : isLightMode
                                    ? 'text-[#08724c] font-bold'
                                    : 'text-[#2bff86] font-bold'
                                }`}
                              >
                                {tok.text}
                              </span>
                            );
                          }

                          const blockWidthCh = Math.max(3, Math.min(11, tok.length));
                          return (
                            <button
                              key={tok.id}
                              type="button"
                              onClick={() => setShowLengthsOnBlocks((v) => !v)}
                              title={`${tok.isNumber ? `${tok.digitCount} digits` : `${tok.length} letters`} (Click to toggle lengths)`}
                              style={{ minWidth: `${blockWidthCh * 0.56}rem` }}
                              className={`inline-flex items-center justify-center align-baseline mx-0.5 px-1 py-0.5 rounded-md text-[11px] font-mono tabular-nums font-bold cursor-pointer select-none transition-all ${
                                tok.isNumber
                                  ? 'bg-[#ee7a2c]/85 text-white border border-[#ffad75]'
                                  : tok.isTitleWord
                                  ? 'bg-[#ffe536]/85 text-[#111809] border border-[#fff799]'
                                  : isLightMode
                                  ? 'bg-[#bbd5f0] text-[#102c4b] hover:bg-[#a3c6eb]'
                                  : 'bg-[#123e73] text-[#96b8dd] hover:bg-[#195396] border border-[#1d5ca1]'
                              }`}
                            >
                              {showLengthsOnBlocks
                                ? tok.isNumber
                                  ? `${tok.digitCount}D`
                                  : tok.length
                                : '\u00A0'.repeat(Math.min(7, tok.length))}
                            </button>
                          );
                        })}
                      </p>
                    ))}
                  </div>
                </section>
              </main>
            )}
        </div>
      </div>

      {/* ── TikTok Live Stream Connector & Debug Modal ── */}
      <TikTokStreamModal
        isOpen={isStreamModalOpen}
        onClose={() => setIsStreamModalOpen(false)}
        authenticatedStreamer={authenticatedStreamer}
        onStreamerLogin={handleStreamerLogin}
        onStreamerLogout={() => performStreamerLogout('Logged out of TikTok Live panel.')}
        connectionState={tiktokConnState}
        connectedUsername={connectedUsername}
        connectedRoomId={connectedRoomId}
        errorMessage={tiktokError}
        onConnectTikTok={handleConnectTikTok}
        onDisconnectTikTok={handleDisconnectTikTok}
        onSimulateChat={(data) => {
          recordActivity();
          socketRef.current?.emit('chat-message', data);
        }}
        onSimulateLike={(data) => {
          recordActivity();
          socketRef.current?.emit('like-event', data);
        }}
        onSimulateGift={(data) => {
          recordActivity();
          socketRef.current?.emit('gift-event', data);
        }}
        totalLikesCount={totalLikesCount}
        totalGiftsCount={totalGiftsCount}
      />

      {/* ── Admin Portal Modal ── */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />
    </div>
  );
}
