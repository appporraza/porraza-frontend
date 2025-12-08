"use client";

import { useState, useEffect, useMemo } from "react";
import {
  SingleEliminationBracket,
  createTheme,
  type MatchComponentProps,
  type MatchType,
} from "react-tournament-brackets";
import { Info, Trophy, CheckCircle2 } from "lucide-react";
import { Badge } from "@/presentation/components/ui/badge";
import { TeamFlag } from "@/presentation/components/ui/team-flag";
import {
  ScrollArea,
  ScrollBar,
} from "@/presentation/components/ui/scroll-area";
import { KnockoutMatchDialog } from "@/presentation/components/predictions/knockout-match-dialog";
import { cn } from "@/presentation/utils/cn";
import type { RoundOf32Match } from "@/domain/entities/round-of-32-match";
import type { Knockouts } from "@/domain/entities/knockouts";
import type { UserMatchPrediction } from "@/domain/entities/match-with-prediction";
import type { MatchPhase } from "@/domain/entities/match";
import type { MatchPrediction } from "@/domain/entities/match-prediction";
import {
  convertToTournamentBracket,
  isTBDParticipant,
} from "@/presentation/utils/tournament-bracket-utils";

interface KnockoutBracketProps {
  matches: RoundOf32Match[];
  knockouts: Knockouts | null;
  predictionId: string | null;
  onSave: (
    phase: MatchPhase,
    matchPredictions: MatchPrediction[]
  ) => Promise<void>;
  isSaving: boolean;
}

/**
 * Helper: Determinar ganador basado en predicción del usuario
 * @param prediction - UserMatchPrediction
 * @returns 'home' | 'away' | 'draw' | null
 */
function getMatchWinner(
  prediction: UserMatchPrediction | null
): "home" | "away" | "draw" | null {
  if (!prediction) return null;

  // 1. Si hay ganador por penalties, ese es el ganador final
  if (prediction.penaltiesWinner) {
    return prediction.penaltiesWinner as "home" | "away";
  }

  // 2. Si hay scores de extra time, comparar ET
  if (prediction.homeScoreET !== null && prediction.awayScoreET !== null) {
    if (prediction.homeScoreET > prediction.awayScoreET) return "home";
    if (prediction.awayScoreET > prediction.homeScoreET) return "away";
    // Si ET está empatado y no hay penaltiesWinner, es draw (no debería pasar)
    return "draw";
  }

  // 3. Comparar resultado regular (90 minutos)
  if (prediction.homeScore > prediction.awayScore) return "home";
  if (prediction.awayScore > prediction.homeScore) return "away";

  // Empate en 90' sin ET definido
  return "draw";
}

/**
 * Porraza Custom Theme for react-tournament-brackets
 * Matches the brand colors:
 * - Primary: #2a398d
 * - Secondary: #3cac3b
 * - Destructive: #e61d25
 */
const PorrazaTheme = createTheme({
  fontFamily: "Poppins, sans-serif",
  transitionTimingFunction: "ease-in-out",
  disabledColor: "#cbd5e1",
  textColor: {
    main: "#0f172a",
    highlighted: "#2a398d", // Primary blue
    dark: "#64748b",
    disabled: "#cbd5e1",
  },
  matchBackground: {
    wonColor: "#d1fae5", // Light green tint (secondary)
    lostColor: "#fee2e2", // Light red tint (destructive)
  },
  score: {
    background: {
      wonColor: "#3cac3b", // Secondary green for winners
      lostColor: "#e61d25", // Destructive red for losers
    },
    text: {
      highlightedWonColor: "#ffffff",
      highlightedLostColor: "#ffffff",
    },
  },
  border: {
    color: "#cbd5e1",
    highlightedColor: "#2a398d", // Primary blue for highlights
  },
  roundHeaders: {
    background: "#2a398d", // Primary blue headers
  },
  canvasBackground: "#fafafa",
});

/**
 * Custom Match Component with TeamFlag integration
 * Displays teams with their flags in a compact format
 * Now with support for user predictions and visual winner/loser styles
 */
interface CustomMatchProps extends MatchComponentProps {
  userPrediction?: UserMatchPrediction | null;
}

function CustomMatch({
  match,
  onMatchClick,
  onPartyClick,
  onMouseEnter,
  onMouseLeave,
  topParty,
  bottomParty,
  topWon,
  bottomWon,
  topHovered,
  bottomHovered,
  topText,
  bottomText,
  connectorColor,
  computedStyles,
  teamNameFallback,
  resultFallback,
  userPrediction,
}: CustomMatchProps) {
  const isTBD =
    isTBDParticipant(topParty.fifaCode) ||
    isTBDParticipant(bottomParty.fifaCode);

  // Determine winner based on user prediction
  const winner = userPrediction ? getMatchWinner(userPrediction) : null;
  const homeWon = winner === "home";
  const awayWon = winner === "away";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "stretch",
        width: "100%",
        height: "100%",
        // Mobile: 88px for better touch target, Desktop: 72px
        minHeight: "88px",
      }}
      onClick={(event: React.MouseEvent<HTMLDivElement>) =>
        onMatchClick?.({
          match,
          topWon: homeWon,
          bottomWon: awayWon,
          event: event as unknown as React.MouseEvent<
            HTMLAnchorElement,
            MouseEvent
          >,
        })
      }
      className={cn(
        // Base styles - simplified gradient for mobile performance
        "group relative cursor-pointer rounded-lg",
        "bg-gradient-to-br from-card to-primary/5 md:via-card",
        // Border - conditional based on prediction
        !userPrediction && "border-2 border-dashed border-primary/30",
        userPrediction && "border-2 border-primary/30",
        // Shadow - lighter on mobile for performance
        "shadow-sm shadow-primary/5 transition-all duration-200 md:duration-300",
        // Touch feedback (active) + Desktop hover
        "active:scale-[0.98] active:border-secondary md:hover:scale-[1.02]",
        "md:hover:border-secondary md:hover:shadow-lg md:hover:shadow-secondary/20",
        // TBD states
        isTBD &&
          "border-dashed border-destructive/30 opacity-60 active:opacity-80 md:hover:opacity-80"
      )}
    >
      {/* Gradient overlay - only on desktop hover for performance */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-secondary/0 to-secondary/5 opacity-0 transition-opacity duration-300 md:group-hover:opacity-100" />

      {/* Top Team (Home) */}
      <div
        className={cn(
          "relative z-10 flex items-center transition-colors duration-200",
          // Mobile: more padding (py-3), Desktop: compact (py-2.5)
          "gap-2 px-3 py-3 md:gap-2 md:py-2.5",
          "border-b border-primary/10",
          // Winner styles
          homeWon && "bg-secondary/10",
          // Loser styles
          awayWon && "bg-muted/50 opacity-50",
          topHovered && "bg-secondary/10"
        )}
        onMouseEnter={() => onMouseEnter?.(topParty.id)}
        onMouseLeave={onMouseLeave}
      >
        <TeamFlag
          fifaCode={topParty.fifaCode || "TBD"}
          teamName={topParty.name || "TBD"}
          // Mobile: md (48px), Desktop: sm (40px)
          size="md"
          rounded="sm"
          bordered
          className={cn(
            "shrink-0 transition-transform duration-200 md:size-sm md:group-hover:scale-110",
            awayWon && "grayscale"
          )}
        />
        <span
          className={cn(
            // Mobile: sm text (14px), Desktop: xs (12px)
            "flex-1 truncate text-sm font-semibold transition-colors duration-200 md:text-xs",
            topHovered && "text-secondary",
            homeWon && "text-secondary",
            awayWon && "text-muted-foreground",
            !homeWon && !awayWon && "text-foreground"
          )}
          title={topParty.name || teamNameFallback}
        >
          {topText || topParty.name || teamNameFallback}
        </span>
        {/* Winner icon */}
        {homeWon && <CheckCircle2 className="size-4 shrink-0 text-secondary" />}
        {/* Score badge */}
        {userPrediction && (
          <span
            className={cn(
              "rounded-md px-2 py-1 text-xs font-bold shadow-sm md:py-0.5",
              homeWon
                ? "bg-secondary text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            {userPrediction.homeScore}
          </span>
        )}
      </div>

      {/* Bottom Team (Away) */}
      <div
        className={cn(
          "relative z-10 flex items-center transition-colors duration-200",
          "gap-2 px-3 py-3 md:gap-2 md:py-2.5",
          // Winner styles
          awayWon && "bg-secondary/10",
          // Loser styles
          homeWon && "bg-muted/50 opacity-50",
          bottomHovered && "bg-secondary/10"
        )}
        onMouseEnter={() => onMouseEnter?.(bottomParty.id)}
        onMouseLeave={onMouseLeave}
      >
        <TeamFlag
          fifaCode={bottomParty.fifaCode || "TBD"}
          teamName={bottomParty.name || "TBD"}
          size="md"
          rounded="sm"
          bordered
          className={cn(
            "shrink-0 transition-transform duration-200 md:size-sm md:group-hover:scale-110",
            homeWon && "grayscale"
          )}
        />
        <span
          className={cn(
            "flex-1 truncate text-sm font-semibold transition-colors duration-200 md:text-xs",
            bottomHovered && "text-secondary",
            awayWon && "text-secondary",
            homeWon && "text-muted-foreground",
            !homeWon && !awayWon && "text-foreground"
          )}
          title={bottomParty.name || teamNameFallback}
        >
          {bottomText || bottomParty.name || teamNameFallback}
        </span>
        {/* Winner icon */}
        {awayWon && <CheckCircle2 className="size-4 shrink-0 text-secondary" />}
        {/* Score badge */}
        {userPrediction && (
          <span
            className={cn(
              "rounded-md px-2 py-1 text-xs font-bold shadow-sm md:py-0.5",
              awayWon
                ? "bg-secondary text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            {userPrediction.awayScore}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Knockout Bracket Component
 *
 * Displays the complete knockout phase bracket for the World Cup 2026
 * Features:
 * - Complete single elimination bracket (16avos through Final)
 * - Custom theme matching Porraza brand colors
 * - Custom Match component with TeamFlag integration
 * - SVG-based bracket visualization with smooth connectors
 * - Click to open detailed match information
 * - Automatic removal of "Round" prefix from round headers
 */
export function KnockoutBracket({
  matches,
  knockouts,
  predictionId,
  onSave,
  isSaving,
}: KnockoutBracketProps) {
  const [selectedMatch, setSelectedMatch] = useState<RoundOf32Match | null>(
    null
  );
  const [selectedPrediction, setSelectedPrediction] =
    useState<UserMatchPrediction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Responsive dimensions for mobile optimization
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    // Initialize window width on mount
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // Set initial value
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Calculate responsive bracket dimensions
  const bracketConfig = useMemo(() => {
    const isMobile = windowWidth > 0 && windowWidth < 768;
    const isTablet = windowWidth >= 768 && windowWidth < 1024;

    return {
      // Box dimensions (match container height)
      boxHeight: isMobile ? 100 : isTablet ? 105 : 100,

      // Spacing between columns (rounds)
      spaceBetweenColumns: isMobile ? 60 : isTablet ? 75 : 80,

      // Spacing between rows (matches)
      spaceBetweenRows: isMobile ? 15 : isTablet ? 20 : 25,

      // Canvas padding
      canvasPadding: isMobile ? 20 : isTablet ? 30 : 40,

      // Round header
      roundHeader: {
        fontSize: isMobile ? 12 : 14,
        height: isMobile ? 30 : 40,
        marginBottom: isMobile ? 15 : 20,
      },
    };
  }, [windowWidth]);

  // Create a map of predictions by matchId for quick lookup
  // Extract predictions from all knockout rounds (progressive resolution)
  const predictionsMap = useMemo(() => {
    if (!knockouts) return new Map<string, UserMatchPrediction>();

    const map = new Map<string, UserMatchPrediction>();

    // Helper to convert UserKnockoutPrediction to UserMatchPrediction format
    const convertPrediction = (
      matchId: string,
      pred: any
    ): UserMatchPrediction => ({
      id: pred.id,
      predictionId: null,
      matchId: pred.matchId,
      homeScore: pred.homeScore,
      awayScore: pred.awayScore,
      homeScoreET: pred.homeScoreET,
      awayScoreET: pred.awayScoreET,
      penaltiesWinner: pred.penaltiesWinner,
      pointsEarned: pred.pointsEarned,
      pointsBreakdown: {},
      createdAt: null,
      updatedAt: null,
    });

    // Process all rounds
    knockouts.roundOf32.forEach((match) => {
      if (match.userPrediction) {
        map.set(match.id, convertPrediction(match.id, match.userPrediction));
      }
    });

    knockouts.roundOf16.forEach((match) => {
      if (match.userPrediction) {
        map.set(match.id, convertPrediction(match.id, match.userPrediction));
      }
    });

    knockouts.quarterFinals.forEach((match) => {
      if (match.userPrediction) {
        map.set(match.id, convertPrediction(match.id, match.userPrediction));
      }
    });

    knockouts.semiFinals.forEach((match) => {
      if (match.userPrediction) {
        map.set(match.id, convertPrediction(match.id, match.userPrediction));
      }
    });

    if (knockouts.final.userPrediction) {
      map.set(
        knockouts.final.id,
        convertPrediction(knockouts.final.id, knockouts.final.userPrediction)
      );
    }

    return map;
  }, [knockouts]);

  if (!knockouts || !knockouts.roundOf32 || knockouts.roundOf32.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-card via-primary/5 to-secondary/5 p-8 text-center shadow-lg shadow-primary/5 md:p-12">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-xl shadow-primary/30 md:size-20">
          <Info className="size-8 text-white md:size-10" />
        </div>
        <h3 className="mb-2 text-lg font-bold text-primary md:text-xl">
          16avos de Final
        </h3>
        <p className="mx-auto max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
          Los emparejamientos de 16avos de final se mostrarán cuando se
          completen todos los grupos.
        </p>
        <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-primary via-secondary to-primary md:mt-6 md:w-24" />
      </div>
    );
  }

  // Convert knockouts structure to tournament bracket format
  // Backend now sends data in correct bracket order
  const tournamentMatches = convertToTournamentBracket(knockouts);

  // Create explicit mapping between tournamentMatchId and actual knockout matches
  // This ensures correct match retrieval when clicking on bracket
  const tournamentMatchMap = useMemo(() => {
    if (!knockouts) return new Map();

    const map = new Map<number, (typeof knockouts.roundOf32)[0]>();

    // Round of 32: tournament IDs 1-16
    knockouts.roundOf32.forEach((match, index) => {
      const tournamentId = index + 1;
      map.set(tournamentId, match);
    });

    // Round of 16: tournament IDs 17-24
    knockouts.roundOf16.forEach((match, index) => {
      map.set(17 + index, match);
    });

    // Quarter Finals: tournament IDs 25-28
    knockouts.quarterFinals.forEach((match, index) => {
      map.set(25 + index, match);
    });

    // Semi Finals: tournament IDs 29-30
    knockouts.semiFinals.forEach((match, index) => {
      map.set(29 + index, match);
    });

    // Final: tournament ID 31
    map.set(31, knockouts.final);

    return map;
  }, [knockouts]);

  // Create CustomMatch wrapper with access to predictionsMap
  const CustomMatchWithPredictions = (props: MatchComponentProps) => {
    const tournamentMatchId = Number(props.match.id);
    const knockoutMatch = tournamentMatchMap.get(tournamentMatchId);
    const userPrediction = knockoutMatch
      ? predictionsMap.get(knockoutMatch.id)
      : null;

    return <CustomMatch {...props} userPrediction={userPrediction} />;
  };

  // Handle match click to open dialog
  const handleMatchClick = (args: { match: MatchType }) => {
    const tournamentMatchId = Number(args.match.id);
    const knockoutMatch = tournamentMatchMap.get(tournamentMatchId);

    if (knockoutMatch && knockoutMatch.homeTeam && knockoutMatch.awayTeam) {
      const legacyMatch = {
        id: knockoutMatch.id,
        matchNumber: knockoutMatch.matchNumber,
        homeTeam: knockoutMatch.homeTeam,
        awayTeam: knockoutMatch.awayTeam,
        stadium: knockoutMatch.stadium,
        matchDate: knockoutMatch.matchDate,
        matchTime: knockoutMatch.matchTime,
        phase: knockoutMatch.phase as MatchPhase,
        predictionsLockedAt: knockoutMatch.predictionsLockedAt,
      };

      const userPrediction = predictionsMap.get(knockoutMatch.id) || null;

      setSelectedMatch(legacyMatch);
      setSelectedPrediction(userPrediction);
      setIsDialogOpen(true);
    }
  };

  // Remove "Round " prefix from round headers in SVG
  useEffect(() => {
    const removeRoundPrefix = () => {
      const textElements = document.querySelectorAll("svg text");
      textElements.forEach((textElement) => {
        const content = textElement.textContent;
        if (content && content.startsWith("Round ")) {
          textElement.textContent = content.replace("Round ", "");
        }
      });
    };

    const timer1 = setTimeout(removeRoundPrefix, 50);
    const timer2 = setTimeout(removeRoundPrefix, 200);
    const timer3 = setTimeout(removeRoundPrefix, 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [tournamentMatches]);

  return (
    <div className="space-y-6">
      {/* Header - Optimized for Mobile */}
      <div className="flex flex-col gap-3 rounded-lg border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 p-3 shadow-sm sm:p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <h2 className="flex items-center gap-2 text-xl font-bold text-primary md:text-2xl">
            <div className="rounded-lg bg-primary p-1.5 shadow-md shadow-primary/30 md:p-2">
              <Trophy className="size-5 text-white md:size-6" />
            </div>
            Eliminatorias
          </h2>
          <p className="mt-1 ml-9 text-xs font-medium text-muted-foreground md:ml-14 md:text-sm">
            Fase final del Mundial 2026
          </p>
        </div>
        <Badge
          variant="secondary"
          className="w-fit self-start bg-secondary text-xs text-white shadow-md shadow-secondary/30 hover:bg-secondary/90 md:self-center md:text-sm"
        >
          {tournamentMatches.length} partidos
        </Badge>
      </div>

      {/* Bracket Container with ScrollArea - Mobile Optimized */}
      <div className="relative">
        {/* Scroll indicator for mobile */}
        <div className="pointer-events-none absolute right-4 top-4 z-20 rounded-full bg-secondary/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg md:hidden">
          ← Desliza →
        </div>

        <ScrollArea className="h-[500px] w-full max-w-full rounded-xl border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-lg shadow-primary/10 sm:h-[600px] md:h-[800px] md:via-background">
          <div className="min-w-fit p-4 sm:p-6 md:p-8">
            <SingleEliminationBracket
              matches={tournamentMatches}
              matchComponent={CustomMatchWithPredictions}
              theme={PorrazaTheme}
              options={{
                style: {
                  // Responsive box dimensions
                  boxHeight: bracketConfig.boxHeight,
                  spaceBetweenColumns: bracketConfig.spaceBetweenColumns,
                  spaceBetweenRows: bracketConfig.spaceBetweenRows,
                  canvasPadding: bracketConfig.canvasPadding,

                  // Round header configuration
                  roundHeader: {
                    backgroundColor: "#2a398d",
                    fontColor: "#ffffff",
                    fontFamily: "Poppins, sans-serif",
                    fontSize: bracketConfig.roundHeader.fontSize,
                    height: bracketConfig.roundHeader.height,
                    marginBottom: bracketConfig.roundHeader.marginBottom,
                    isShown: true,
                  },

                  // Connector colors
                  connectorColor: "#9ca9d9",
                  connectorColorHighlight: "#3cac3b",
                },
              }}
              onMatchClick={handleMatchClick}
            />
          </div>
          {/* Enhanced scroll bars */}
          <ScrollBar
            orientation="horizontal"
            className="h-2.5 bg-primary/10 md:h-2 md:bg-primary/5"
          />
          <ScrollBar
            orientation="vertical"
            className="w-2.5 bg-primary/10 md:w-2 md:bg-primary/5"
          />
        </ScrollArea>
      </div>

      {/* Info Footer - Mobile Optimized */}
      <div className="group rounded-lg border-2 border-secondary/30 bg-gradient-to-r from-secondary/5 via-primary/5 to-secondary/5 p-3 shadow-sm transition-all active:border-secondary/50 md:p-4 md:hover:border-secondary/50 md:hover:shadow-md md:hover:shadow-secondary/10">
        <div className="flex gap-2.5 md:gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-secondary to-secondary/80 shadow-md shadow-secondary/30 md:size-10">
            <Info className="size-4 text-white md:size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground md:text-sm">
              Bracket de eliminatorias directas
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-secondary">Toca</span> cualquier
              partido para ver detalles. Los equipos{" "}
              <span className="font-medium text-destructive">"TBD"</span> se
              definirán en rondas previas.
            </p>
          </div>
        </div>
      </div>

      {/* Match Details Dialog with complete match data */}
      {selectedMatch && (
        <KnockoutMatchDialog
          match={selectedMatch}
          userPrediction={selectedPrediction}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          predictionId={predictionId}
          onSave={onSave}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
