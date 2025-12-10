"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale } from "next-intl";
import {
  MapPin,
  Calendar,
  Clock,
  Users,
  Trophy,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/presentation/components/ui/badge";
import { TeamFlag } from "@/presentation/components/ui/team-flag";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/presentation/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/presentation/components/ui/drawer";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldError,
} from "@/presentation/components/ui/field";
import { useIsMobile } from "@/presentation/hooks/use-mobile";
import { cn } from "@/presentation/utils/cn";
import { toast } from "sonner";
import type { RoundOf32Match } from "@/domain/entities/round-of-32-match";
import type { UserMatchPrediction } from "@/domain/entities/match-with-prediction";
import type { MatchPhase } from "@/domain/entities/match";
import type { MatchPrediction } from "@/domain/entities/match-prediction";
import {
  knockoutMatchPredictionSchema,
  type KnockoutMatchPredictionFormData,
} from "@/presentation/schemas/knockout-prediction-schema";
import {
  formatFullDate,
  formatTime,
  formatCapacity,
} from "@/presentation/utils/formatters";

interface KnockoutMatchDialogProps {
  match: RoundOf32Match;
  userPrediction: UserMatchPrediction | null;
  isOpen: boolean;
  onClose: () => void;
  predictionId: string | null;
  onSave: (
    phase: MatchPhase,
    matchPredictions: MatchPrediction[]
  ) => Promise<void>;
  isSaving: boolean;
}

/**
 * Shared content component for both Dialog and Drawer
 * Contains the complete match information and prediction form
 */
interface MatchContentProps {
  match: RoundOf32Match;
  userPrediction: UserMatchPrediction | null;
  onClose: () => void;
  predictionId: string | null;
  onSave: (
    phase: MatchPhase,
    matchPredictions: MatchPrediction[]
  ) => Promise<void>;
  isSaving: boolean;
  className?: string;
}

function MatchContent({
  match,
  userPrediction,
  onClose,
  predictionId,
  onSave,
  isSaving,
  className,
}: MatchContentProps) {
  const locale = useLocale();
  const [imageError, setImageError] = useState(false);

  // Initialize form with react-hook-form + Zod validation
  const form = useForm<KnockoutMatchPredictionFormData>({
    resolver: zodResolver(knockoutMatchPredictionSchema),
    mode: "onSubmit", // Only validate when user submits
    defaultValues: {
      matchId: match.id,
      homeTeamId: match.homeTeam.id,
      awayTeamId: match.awayTeam.id,
      // Pre-fill with userPrediction if exists, otherwise empty
      homeScore: userPrediction?.homeScore ?? (undefined as any),
      awayScore: userPrediction?.awayScore ?? (undefined as any),
      homeScoreET: userPrediction?.homeScoreET ?? null,
      awayScoreET: userPrediction?.awayScoreET ?? null,
      penaltiesWinner: userPrediction?.penaltiesWinner
        ? (userPrediction.penaltiesWinner as "home" | "away")
        : null,
    },
  });

  // Watch form values for dynamic field display
  const homeScore = form.watch("homeScore");
  const awayScore = form.watch("awayScore");
  const homeScoreET = form.watch("homeScoreET");
  const awayScoreET = form.watch("awayScoreET");
  const penaltiesWinner = form.watch("penaltiesWinner");

  // Helper to check if a value is a valid number (not NaN, not undefined, not null)
  const isValidNumber = (val: any): val is number => {
    return typeof val === "number" && !isNaN(val) && val !== null;
  };

  // Only show ET fields when user has entered valid scores AND they're tied
  const hasValidRegularTimeScores =
    isValidNumber(homeScore) && isValidNumber(awayScore);
  const isTied = hasValidRegularTimeScores && homeScore === awayScore;

  // Check if user has entered valid ET scores
  const hasValidETScores =
    isValidNumber(homeScoreET) && isValidNumber(awayScoreET);

  // Show penalties ONLY when:
  // 1. Regular time is tied (otherwise ET fields are not visible)
  // 2. User has entered valid ET scores
  // 3. Those ET scores are also tied
  const isTiedInET = hasValidETScores && homeScoreET === awayScoreET;
  const showPenalties = isTied && isTiedInET;

  // Reset ET and penalties when regular time is no longer tied
  useEffect(() => {
    if (hasValidRegularTimeScores && !isTied) {
      // User changed scores and it's no longer tied - clear ET/penalties
      form.setValue("homeScoreET", null);
      form.setValue("awayScoreET", null);
      form.setValue("penaltiesWinner", null);
    }
  }, [hasValidRegularTimeScores, isTied, form]);

  // Reset penalties when ET resolves the tie (no longer needs penalties)
  useEffect(() => {
    if (hasValidETScores && !isTiedInET) {
      // User entered ET scores that resolve the tie - clear penalties
      form.setValue("penaltiesWinner", null);
    }
  }, [hasValidETScores, isTiedInET, form]);

  // Additional safety: Clear penalties if showPenalties becomes false
  useEffect(() => {
    if (!showPenalties && form.getValues("penaltiesWinner") !== null) {
      form.setValue("penaltiesWinner", null);
    }
  }, [showPenalties, form]);

  // Calculate if the form is incomplete (used to disable submit button)
  // This mirrors the Zod schema validation rules to provide real-time feedback
  const isFormIncomplete = (): boolean => {
    // Rule 1: Regular time scores must be valid numbers
    if (!hasValidRegularTimeScores) {
      return true;
    }

    // Rule 2: If tied in regular time, extra time scores must be valid
    if (isTied) {
      if (!hasValidETScores) {
        return true;
      }

      // Rule 2.1: ET scores must be >= regular time scores (cumulative)
      if (hasValidETScores) {
        if (homeScoreET < homeScore || awayScoreET < awayScore) {
          return true;
        }
      }

      // Rule 3: If tied after extra time, penalties winner must be selected
      if (isTiedInET) {
        if (!penaltiesWinner) {
          return true;
        }
      }

      // Rule 4: If NOT tied after extra time, penalties winner should NOT be selected
      if (!isTiedInET) {
        if (penaltiesWinner !== null) {
          return true;
        }
      }
    }

    // Rule 5: If NOT tied in regular time, ET/penalties should be null
    // This catches cases where user had entered ET/penalties but then changed regular time
    if (!isTied) {
      if (
        homeScoreET !== null ||
        awayScoreET !== null ||
        penaltiesWinner !== null
      ) {
        return true;
      }
    }

    return false;
  };

  // Stadium image path
  const stadiumImagePath = `/stadiums/${match.stadium.code}.webp`;

  // Get phase label
  const getPhaseLabel = () => {
    return "16avos de Final"; // For now, all matches are Round of 32
  };

  // Handle form submission
  const onSubmit = async (data: KnockoutMatchPredictionFormData) => {
    if (!predictionId) {
      toast.error("Error", {
        description:
          "No se encontró la predicción. Intenta recargar la página.",
      });
      return;
    }

    try {
      // Convert form data to MatchPrediction entity
      const matchPrediction: MatchPrediction = {
        matchId: data.matchId,
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
        homeScoreET: data.homeScoreET ?? null,
        awayScoreET: data.awayScoreET ?? null,
        penaltiesWinner: data.penaltiesWinner ?? null,
      };

      // Call onSave with ROUND_OF_32 phase and array of single prediction
      await onSave("ROUND_OF_32", [matchPrediction]);

      toast.success("Predicción guardada", {
        description: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      });

      onClose();
    } catch (error) {
      console.error("[KnockoutMatchDialog] Error saving prediction:", error);
      toast.error("Error al guardar", {
        description:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la predicción",
      });
    }
  };

  return (
    <div className={cn("space-y-4 md:space-y-6", className)}>
      {/* Stadium Image Header */}
      <div className="relative overflow-hidden rounded-lg border">
        {!imageError ? (
          <>
            <img
              src={stadiumImagePath}
              alt={match.stadium.name}
              className="h-32 w-full object-cover md:h-48"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent" />
            {/* Stadium info overlay */}
            <div className="absolute bottom-2 left-3 right-3 md:bottom-3 md:left-4 md:right-4">
              <h3 className="mb-0.5 text-sm font-bold text-white md:text-base">
                {match.stadium.name}
              </h3>
              <p className="text-xs text-white/90 md:text-sm">
                {match.stadium.city}, {match.stadium.country}
              </p>
            </div>
          </>
        ) : (
          <div className="flex h-32 items-center justify-center bg-muted md:h-48">
            <MapPin className="size-10 text-muted-foreground md:size-12" />
          </div>
        )}
      </div>

      {/* Match Info Cards */}
      <div className="grid gap-2 text-xs md:grid-cols-3 md:text-sm">
        {/* Date */}
        <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5 md:p-3">
          <Calendar className="size-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium">
              {formatFullDate(match.matchDate, locale)}
            </p>
          </div>
        </div>
        {/* Time */}
        <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5 md:p-3">
          <Clock className="size-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium">{formatTime(match.matchTime)}</p>
          </div>
        </div>
        {/* Capacity */}
        <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5 md:p-3">
          <Users className="size-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium">
              {formatCapacity(match.stadium.capacity, locale)} personas
            </p>
          </div>
        </div>
      </div>

      {/* Teams Display - Compact */}
      <div className="space-y-3 rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 p-3 md:space-y-4 md:p-4">
        {/* Home Team */}
        <div className="flex items-center gap-3">
          <TeamFlag
            fifaCode={match.homeTeam.fifaCode}
            teamName={match.homeTeam.name}
            size="lg"
            rounded="md"
            bordered
            className="shrink-0"
          />
          <div className="flex-1">
            <h3 className="text-base font-bold md:text-lg">
              {match.homeTeam.name}
            </h3>
            <p className="text-xs uppercase text-muted-foreground">
              {match.homeTeam.confederation}
            </p>
          </div>
        </div>

        {/* VS Divider */}
        <div className="flex items-center justify-center">
          <div className="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 px-5 py-2 text-sm font-bold shadow-sm md:text-base">
            VS
          </div>
        </div>

        {/* Away Team */}
        <div className="flex items-center gap-3">
          <TeamFlag
            fifaCode={match.awayTeam.fifaCode}
            teamName={match.awayTeam.name}
            size="lg"
            rounded="md"
            bordered
            className="shrink-0"
          />
          <div className="flex-1">
            <h3 className="text-base font-bold md:text-lg">
              {match.awayTeam.name}
            </h3>
            <p className="text-xs uppercase text-muted-foreground">
              {match.awayTeam.confederation}
            </p>
          </div>
        </div>
      </div>

      {/* Prediction Form */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-lg border-2 border-secondary/30 bg-gradient-to-br from-secondary/5 to-primary/5 p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between md:mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-secondary md:size-5" />
              <h4 className="text-sm font-bold uppercase text-secondary md:text-base">
                Tu Predicción
              </h4>
            </div>
            {userPrediction && userPrediction.id && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <CheckCircle2 className="size-3" />
                Guardada
              </Badge>
            )}
          </div>

          {/* Regular Time Score (90 minutes) */}
          <div className="mb-3 space-y-3 md:mb-4">
            <p className="text-xs font-semibold text-muted-foreground md:text-sm">
              Resultado (90 minutos)
            </p>
            <div className="flex items-center gap-3">
              {/* Home Score */}
              <Field
                className="flex-1"
                data-invalid={!!form.formState.errors.homeScore}
              >
                <FieldLabel htmlFor="homeScore" className="text-xs md:text-sm">
                  {match.homeTeam.fifaCode}
                </FieldLabel>
                <Input
                  id="homeScore"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="-"
                  className="text-center text-base font-bold md:text-lg"
                  {...form.register("homeScore", {
                    setValueAs: (v) =>
                      v === "" || isNaN(v) ? undefined : Number(v),
                  })}
                  aria-invalid={!!form.formState.errors.homeScore}
                />
                <FieldError errors={[form.formState.errors.homeScore]} />
              </Field>

              <span className="text-lg font-bold text-muted-foreground md:text-xl">
                -
              </span>

              {/* Away Score */}
              <Field
                className="flex-1"
                data-invalid={!!form.formState.errors.awayScore}
              >
                <FieldLabel htmlFor="awayScore" className="text-xs md:text-sm">
                  {match.awayTeam.fifaCode}
                </FieldLabel>
                <Input
                  id="awayScore"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="-"
                  className="text-center text-base font-bold md:text-lg"
                  {...form.register("awayScore", {
                    setValueAs: (v) =>
                      v === "" || isNaN(v) ? undefined : Number(v),
                  })}
                  aria-invalid={!!form.formState.errors.awayScore}
                />
                <FieldError errors={[form.formState.errors.awayScore]} />
              </Field>
            </div>
          </div>

          {/* Extra Time (only if tied) */}
          {isTied && (
            <div className="mb-3 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3 md:mb-4">
              <div>
                <p className="text-xs font-semibold text-primary md:text-sm">
                  ⏱️ Tiempo Extra (empate en 90')
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Marcador total acumulado (incluye goles del tiempo regular +
                  prórroga)
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Home Score ET */}
                <Field
                  className="flex-1"
                  data-invalid={!!form.formState.errors.homeScoreET}
                >
                  <FieldLabel
                    htmlFor="homeScoreET"
                    className="text-xs md:text-sm"
                  >
                    {match.homeTeam.fifaCode} (mín. {homeScore})
                  </FieldLabel>
                  <Input
                    id="homeScoreET"
                    type="number"
                    inputMode="numeric"
                    min={homeScore}
                    step="1"
                    placeholder={`≥${homeScore}`}
                    className="text-center text-base font-bold md:text-lg"
                    {...form.register("homeScoreET", {
                      setValueAs: (v) =>
                        v === "" || isNaN(v) ? null : Number(v),
                    })}
                    aria-invalid={!!form.formState.errors.homeScoreET}
                  />
                  <FieldError errors={[form.formState.errors.homeScoreET]} />
                </Field>

                <span className="text-lg font-bold text-muted-foreground md:text-xl">
                  -
                </span>

                {/* Away Score ET */}
                <Field
                  className="flex-1"
                  data-invalid={!!form.formState.errors.awayScoreET}
                >
                  <FieldLabel
                    htmlFor="awayScoreET"
                    className="text-xs md:text-sm"
                  >
                    {match.awayTeam.fifaCode} (mín. {awayScore})
                  </FieldLabel>
                  <Input
                    id="awayScoreET"
                    type="number"
                    inputMode="numeric"
                    min={awayScore}
                    step="1"
                    placeholder={`≥${awayScore}`}
                    className="text-center text-base font-bold md:text-lg"
                    {...form.register("awayScoreET", {
                      setValueAs: (v) =>
                        v === "" || isNaN(v) ? null : Number(v),
                    })}
                    aria-invalid={!!form.formState.errors.awayScoreET}
                  />
                  <FieldError errors={[form.formState.errors.awayScoreET]} />
                </Field>
              </div>
            </div>
          )}

          {/* Penalties (only if tied after ET) */}
          {showPenalties && (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-semibold text-destructive md:text-sm">
                🎯 Ganador por Penaltis
              </p>
              <Field data-invalid={!!form.formState.errors.penaltiesWinner}>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={
                      form.watch("penaltiesWinner") === "home"
                        ? "default"
                        : "outline"
                    }
                    className="w-full"
                    onClick={() => form.setValue("penaltiesWinner", "home")}
                  >
                    {match.homeTeam.fifaCode}
                  </Button>
                  <Button
                    type="button"
                    variant={
                      form.watch("penaltiesWinner") === "away"
                        ? "default"
                        : "outline"
                    }
                    className="w-full"
                    onClick={() => form.setValue("penaltiesWinner", "away")}
                  >
                    {match.awayTeam.fifaCode}
                  </Button>
                </div>
                <FieldError errors={[form.formState.errors.penaltiesWinner]} />
              </Field>
            </div>
          )}

          {/* Form-level errors */}
          {form.formState.errors.root && (
            <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-xs font-medium text-destructive md:text-sm">
                {form.formState.errors.root.message}
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={
            isFormIncomplete() || form.formState.isSubmitting || isSaving
          }
        >
          {form.formState.isSubmitting || isSaving
            ? "Guardando..."
            : userPrediction && userPrediction.id
            ? "Actualizar Predicción"
            : "Guardar Predicción"}
        </Button>
      </form>
    </div>
  );
}

/**
 * Knockout Match Dialog Component
 *
 * Displays detailed information about a knockout match with prediction form
 * Features:
 * - Responsive: Dialog on desktop (≥768px), Drawer on mobile (<768px)
 * - Complete match information (teams, stadium, date, time, capacity)
 * - Interactive prediction form with dynamic fields
 * - Extra time fields appear when regular time is tied
 * - Penalties selector appears when extra time is also tied
 * - Form validation with Zod + react-hook-form
 * - Toast notification on successful save
 */
export function KnockoutMatchDialog({
  match,
  userPrediction,
  isOpen,
  onClose,
  predictionId,
  onSave,
  isSaving,
}: KnockoutMatchDialogProps) {
  const isMobile = useIsMobile();

  // Get phase label
  const getPhaseLabel = () => {
    return "16avos de Final"; // For now, all matches are Round of 32
  };

  // Desktop: Dialog
  if (!isMobile) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{getPhaseLabel()}</span>
              <Badge variant="outline" className="font-normal">
                Partido {match.matchNumber}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <MatchContent
            match={match}
            userPrediction={userPrediction}
            onClose={onClose}
            predictionId={predictionId}
            onSave={onSave}
            isSaving={isSaving}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Drawer
  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[95dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center justify-between">
            <span>{getPhaseLabel()}</span>
            <Badge variant="outline" className="font-normal">
              Partido {match.matchNumber}
            </Badge>
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-4">
          <MatchContent
            match={match}
            userPrediction={userPrediction}
            onClose={onClose}
            predictionId={predictionId}
            onSave={onSave}
            isSaving={isSaving}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
