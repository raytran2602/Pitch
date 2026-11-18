import React, { useEffect, useState } from 'react';
import { getClubBadgeUrl, getPlayerPhotoUrl } from '../data/mediaManifest';
import { Position } from '../types/game';

interface ClubBadgeProps {
  clubId?: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  pattern?: 'solid' | 'stripes' | 'hoops' | 'sash' | 'halves';
  size?: number;
}

export const ClubBadge: React.FC<ClubBadgeProps> = ({
  clubId,
  name,
  shortName,
  primaryColor,
  secondaryColor,
  pattern = 'solid',
  size = 40,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const badgeUrl = getClubBadgeUrl({ clubId, name, shortName });
  useEffect(() => {
    setImgFailed(false);
  }, [badgeUrl]);

  if (badgeUrl && !imgFailed) {
    return (
      <img
        src={badgeUrl}
        alt={`${name} crest`}
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        style={{ width: size, height: size }}
        className="shrink-0 object-contain drop-shadow-sm select-none"
      />
    );
  }

  const clipId = `shield_${shortName}_${size}`;
  const isLightPrimary =
    primaryColor.toUpperCase() === '#FFFFFF' || primaryColor.toUpperCase() === '#FFF200';
  const textColor = isLightPrimary ? '#0F172A' : '#FFFFFF';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-label={`${name} crest`}
      className="shrink-0 drop-shadow-sm"
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M24 3 L42 9 V23 C42 33.5 34 41.5 24 45 C14 41.5 6 33.5 6 23 V9 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="48" height="48" fill={primaryColor} />
        {pattern === 'stripes' && (
          <>
            <rect x="10" y="0" width="6" height="48" fill={secondaryColor} opacity="0.88" />
            <rect x="21" y="0" width="6" height="48" fill={secondaryColor} opacity="0.88" />
            <rect x="32" y="0" width="6" height="48" fill={secondaryColor} opacity="0.88" />
          </>
        )}
        {pattern === 'halves' && (
          <rect x="24" y="0" width="24" height="48" fill={secondaryColor} opacity="0.85" />
        )}
        {pattern === 'sash' && (
          <polygon points="0,42 42,0 48,6 6,48" fill={secondaryColor} opacity="0.88" />
        )}
        {pattern === 'hoops' && (
          <>
            <rect x="0" y="14" width="48" height="7" fill={secondaryColor} opacity="0.85" />
            <rect x="0" y="28" width="48" height="7" fill={secondaryColor} opacity="0.85" />
          </>
        )}
        <rect
          x="0"
          y="16"
          width="48"
          height="16"
          fill={isLightPrimary ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.72)'}
        />
      </g>
      <path
        d="M24 3 L42 9 V23 C42 33.5 34 41.5 24 45 C14 41.5 6 33.5 6 23 V9 Z"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="2"
      />
      <text
        x="24"
        y="27.5"
        textAnchor="middle"
        fill={textColor}
        fontSize="11"
        fontWeight="800"
        fontFamily="Barlow Condensed, sans-serif"
        letterSpacing="0.8"
      >
        {shortName}
      </text>
    </svg>
  );
};

interface PlayerAvatarProps {
  playerId?: string;
  name: string;
  shirtNumber: number;
  position: Position;
  primaryColor: string;
  secondaryColor: string;
  size?: number;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  playerId,
  name,
  shirtNumber,
  position,
  primaryColor,
  secondaryColor,
  size = 40,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const photoUrl = getPlayerPhotoUrl({ playerId, name });
  const [imgMode, setImgMode] = useState<'square' | 'portrait'>(() =>
    photoUrl?.includes('fotmob.com') ? 'square' : 'portrait'
  );
  useEffect(() => {
    setImgFailed(false);
    setImgMode(photoUrl?.includes('fotmob.com') ? 'square' : 'portrait');
  }, [photoUrl]);

  if (photoUrl && !imgFailed) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderColor: position === 'GK' ? '#F59E0B' : primaryColor,
        }}
        className="relative shrink-0 rounded-full overflow-hidden border-2 bg-gradient-to-b from-slate-500/45 via-slate-800/90 to-slate-950 flex items-center justify-center shadow-md select-none"
        aria-label={`${name} miniface`}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.18), rgba(15,23,42,0.1) 70%)',
          }}
        />
        <img
          src={photoUrl}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            const el = e.currentTarget;
            if (el.naturalWidth > 0 && el.naturalHeight > el.naturalWidth * 1.15) {
              setImgMode('portrait');
            } else if (el.naturalWidth > 0) {
              setImgMode('square');
            }
          }}
          onError={() => setImgFailed(true)}
          draggable={false}
          className={
            imgMode === 'square'
              ? 'relative w-full h-full object-cover object-[50%_20%] scale-100'
              : 'relative w-full h-full object-cover object-[50%_8%] scale-100'
          }
        />
      </div>
    );
  }

  let hash = 7;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const skinTones = [
    { face: '#F7D3B5', shade: '#E3B491' },
    { face: '#EBB892', shade: '#D1976F' },
    { face: '#D4986E', shade: '#B6774E' },
    { face: '#B5774F', shade: '#945935' },
    { face: '#8B5434', shade: '#6B3D22' },
    { face: '#603823', shade: '#472615' },
  ];
  const hairColors = ['#181414', '#2F2018', '#523421', '#7A5432', '#B78A47', '#26282E'];
  const skin = skinTones[hash % skinTones.length];
  const hairColor = hairColors[(hash >>> 3) % hairColors.length];
  const hairStyle = (hash >>> 6) % 5; // 0: fade, 1: textured, 2: swept, 3: curly, 4: buzz
  const hasBeard = ((hash >>> 9) % 4) === 0;
  const isLight =
    primaryColor.toUpperCase() === '#FFFFFF' || primaryColor.toUpperCase() === '#FFF200';
  const kitFill = position === 'GK' ? '#F59E0B' : primaryColor;
  const trimFill = position === 'GK' ? '#1E293B' : secondaryColor;
  const textFill = position === 'GK' || isLight ? '#0F172A' : '#FFFFFF';
  const clipId = `mf_${hash}_${size}`;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderColor: position === 'GK' ? '#F59E0B' : primaryColor,
      }}
      className="relative shrink-0 rounded-full overflow-hidden border-2 bg-gradient-to-b from-slate-700/60 via-slate-900 to-slate-950 flex items-center justify-center shadow-md select-none"
      aria-label={`${name} avatar`}
    >
      <svg viewBox="0 0 64 64" className="w-full h-full">
        <defs>
          <radialGradient id={`${clipId}_bg`} cx="50%" cy="32%" r="68%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.72)" />
          </radialGradient>
        </defs>
        <rect width="64" height="64" fill={`url(#${clipId}_bg)`} />

        {/* Jersey & collar */}
        <path
          d="M8 64 C10 47 18 42 32 42 C46 42 54 47 56 64 Z"
          fill={kitFill}
        />
        <path
          d="M14 49 L22 44 M50 49 L42 44"
          stroke={trimFill}
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.88"
        />
        <path
          d="M25 42 Q32 49 39 42"
          fill="none"
          stroke={trimFill}
          strokeWidth="2.4"
        />

        {/* Neck */}
        <rect x="26.5" y="34" width="11" height="10" rx="4" fill={skin.shade} />

        {/* Ears */}
        <ellipse cx="19.5" cy="27.5" rx="2.3" ry="3.8" fill={skin.shade} />
        <ellipse cx="44.5" cy="27.5" rx="2.3" ry="3.8" fill={skin.shade} />

        {/* Head */}
        <path
          d="M20.5 23 C20.5 14.5 25.5 11.5 32 11.5 C38.5 11.5 43.5 14.5 43.5 23 C43.5 32.5 38.5 38.5 32 38.5 C25.5 38.5 20.5 32.5 20.5 23 Z"
          fill={skin.face}
        />

        {/* Subtle beard */}
        {hasBeard && (
          <path
            d="M21.5 29 C22 36 27 39 32 39 C37 39 42 36 42.5 29 C40 34 36.5 35.5 32 35.5 C27.5 35.5 24 34 21.5 29 Z"
            fill={hairColor}
            opacity="0.32"
          />
        )}

        {/* Hair styles */}
        {hairStyle === 0 && (
          <path
            d="M20 23 C19.5 14 25 9.5 32 9.5 C39 9.5 44.5 14 44 23 C42 17.5 38 15.5 32 15.5 C26 15.5 22 17.5 20 23 Z"
            fill={hairColor}
          />
        )}
        {hairStyle === 1 && (
          <path
            d="M19.5 23 C19 14 24.5 8.5 32 8.5 C40 8.5 45 14 44.5 23 C42 18 39 14.5 34.5 16 C31 13.5 28 16.5 24.5 15.5 C22 17 20.5 19.5 19.5 23 Z"
            fill={hairColor}
          />
        )}
        {hairStyle === 2 && (
          <path
            d="M20 23 C20 13 26 9 33.5 9.5 C40.5 10 44.5 15 43.5 23 C41.5 17 36.5 14.5 29 15.5 C24.5 16 21.5 19 20 23 Z"
            fill={hairColor}
          />
        )}
        {hairStyle === 3 && (
          <path
            d="M19 22 C18 17 21 11 25.5 10.5 C27 8 31.5 7.5 34 9.5 C38 8 42.5 10.5 43.5 14.5 C45.5 16.5 45 20 43.5 22.5 C41.5 17 37.5 15 32 15 C26.5 15 22 17 19 22 Z"
            fill={hairColor}
          />
        )}
        {hairStyle === 4 && (
          <path
            d="M20.5 21.5 C21 14 25.8 11 32 11 C38.2 11 43 14 43.5 21.5 C40.5 17 36.5 15.8 32 15.8 C27.5 15.8 23.5 17 20.5 21.5 Z"
            fill={hairColor}
            opacity="0.85"
          />
        )}

        {/* Brows & Eyes */}
        <path d="M24.5 23 Q27 22 29.2 23" stroke={hairColor} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <path d="M34.8 23 Q37 22 39.5 23" stroke={hairColor} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <circle cx="27" cy="25.2" r="1.35" fill="#111827" />
        <circle cx="37" cy="25.2" r="1.35" fill="#111827" />
        <circle cx="26.6" cy="24.8" r="0.4" fill="#FFFFFF" />
        <circle cx="36.6" cy="24.8" r="0.4" fill="#FFFFFF" />

        {/* Nose & Mouth */}
        <path d="M32 25.5 L31.3 29.5 L32.6 29.8" stroke={skin.shade} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M29 33 Q32 34.7 35 33" stroke="#8C4A3E" strokeWidth="1.2" strokeLinecap="round" fill="none" />

        {/* Shirt Number Badge */}
        <rect
          x="23"
          y="48"
          width="18"
          height="12"
          rx="4"
          fill="rgba(15,23,42,0.45)"
        />
        <text
          x="32"
          y="57.2"
          textAnchor="middle"
          fill={textFill}
          fontSize="10"
          fontWeight="800"
          fontFamily="JetBrains Mono, monospace"
        >
          {shirtNumber}
        </text>
      </svg>
    </div>
  );
};
