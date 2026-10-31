export type GameMode = 'HOME' | 'DAILY' | 'SOLO' | 'ONLINE' | 'WIKIREC_GRID' | 'WIKIWORD_QUOTE' | 'TYCOON_HUB' | 'ARCHIVE';

export type PlatformType = 'web' | 'tiktok' | 'youtube' | 'discord';

export interface ArticleToken {
  id: number;
  type: 'word' | 'space';
  text: string;
  norm: string;
  length: number;
  isStop: boolean;
  isNumber: boolean;
  digitCount: number;
  isTitleWord: boolean;
  revealed: boolean;
  foundBy?: {
    username: string;
    avatar: string;
    platform: PlatformType;
  };
}

export interface TitleToken {
  index: number;
  text: string;
  norm: string;
  length: number;
  revealed: boolean;
  foundBy?: {
    username: string;
    avatar: string;
    platform: PlatformType;
  };
}

export interface RankCard {
  word: string;
  norm: string;
  rank: number;
  similarity: number;
  countInArticle: number;
  pointsEarned: number;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'ULTRA' | 'TITLE';
  finder: {
    username: string;
    displayName: string;
    avatar: string;
    platform: PlatformType;
    cosmeticTitle?: string;
  };
  timestamp: number;
}

export interface GridTargetCard {
  id: string;
  word: string;
  norm: string;
  length: number;
  tier: 'TITLE' | 'PYRAMID_1' | 'PYRAMID_2' | 'PYRAMID_3';
  revealed: boolean;
  closeness: number;
  hintLetters: string[];
  path: number[];
  finder?: {
    username: string;
    displayName: string;
    avatar: string;
    platform: PlatformType;
  };
}

export interface GridBoard {
  rows: number;
  cols: number;
  cells: string[];
  targets: GridTargetCard[];
  bonusWordsFound: {
    word: string;
    finder: string;
    platform: PlatformType;
    points: number;
  }[];
}

export interface PlayerScore {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  platform: PlatformType;
  score: number;
  wordsFound: number;
  titleWordsFound: number;
  bestRank: number;
  elo: number;
  cosmeticTitle: string;
  borderColor: string;
}

export interface WordAnnouncement {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  platform: PlatformType;
  word: string;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'ULTRA' | 'TITLE';
  pointsEarned: number;
  totalPoints: number;
  rank?: number;
  timestamp: number;
}

export interface TikTokChatMessage {
  id: string;
  uniqueId: string;
  nickname: string;
  comment: string;
  profilePictureUrl: string;
  timestamp: number;
  streamUsername?: string;
}

export interface TikTokLikeEvent {
  uniqueId: string;
  nickname: string;
  likeCount: number;
  totalLikeCount: number;
  profilePictureUrl: string;
}

export interface TikTokGiftEvent {
  uniqueId: string;
  nickname: string;
  giftName: string;
  diamondCount: number;
  repeatCount: number;
  repeatEnd?: boolean;
  profilePictureUrl: string;
}

export interface AuthorizedStreamer {
  username: string; // stored with leading @ e.g. @mrdimpz
  key: string;
  activeSocketId?: string | null;
  connectedLiveRoomId?: string | null;
  connectedLiveUsername?: string | null;
}

export interface RoundState {
  roundId: string;
  mode: 'WIKICONTEXTO' | 'WIKIREC_GRID' | 'WIKIWORD_QUOTE';
  isDaily: boolean;
  dailyDate?: string;
  articleTitle: string;
  articleCategory: string;
  articleSummaryQuote?: string;
  titleTokens: TitleToken[];
  paragraphs: ArticleToken[][];
  totalWords: number;
  revealedWordsCount: number;
  guessCount: number;
  solved: boolean;
  solvedBy?: {
    username: string;
    displayName: string;
    avatar: string;
    platform: PlatformType;
  };
  topRankCards: RankCard[];
  recentTicker: RankCard[];
  leaderboard: PlayerScore[];
  lastAnnouncement: WordAnnouncement | null;
  gridBoard?: GridBoard;
  startedAt: number;
}

export interface TycoonBusiness {
  id: string;
  name: string;
  category: string;
  level: number;
  baseCost: number;
  coinsPerMinute: number;
  wordBonusPct: number;
  description: string;
}

export interface TycoonCosmetic {
  id: string;
  name: string;
  slot: 'title' | 'frame' | 'tile_skin';
  price: number;
  previewHex: string;
  unlocked: boolean;
  equipped: boolean;
}

export interface UserEconomyProfile {
  username: string;
  displayName: string;
  avatar: string;
  coins: number;
  elo: number;
  xp: number;
  level: number;
  roundsWon: number;
  totalWordsFound: number;
  dailyStreak: number;
  equippedTitle: string;
  equippedFrame: string;
  equippedTileSkin: string;
  businesses: TycoonBusiness[];
  cosmetics: TycoonCosmetic[];
  completedDailies: string[];
}

export interface ArchivePuzzleItem {
  date: string;
  title: string;
  category: string;
  difficulty: 'Standard' | 'Challenging' | 'Expert';
  wordCount: number;
  completed: boolean;
}
