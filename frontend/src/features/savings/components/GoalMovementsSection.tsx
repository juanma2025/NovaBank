import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { APP_MESSAGES, SAVINGS_MESSAGES } from '../../../lib/messages.ts';
import { MovementList } from '../../home/components/MovementList.tsx';
import { useGoalMovements } from '../hooks/useSavings.ts';

export interface GoalMovementsSectionProps {
  goalId: string;
  hideAmounts: boolean;
}

/** Historial paginado de aportes y retiros de una meta de ahorro (spec 005, T017). */
export function GoalMovementsSection({ goalId, hideAmounts }: GoalMovementsSectionProps) {
  const movementsQuery = useGoalMovements(goalId);
  const items = movementsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <GlassCard className="space-y-4">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">
        {SAVINGS_MESSAGES.movementsTitle}
      </h2>

      {movementsQuery.isError ? (
        <Alert
          variant="error"
          action={
            <Button
              variant="secondary"
              loading={movementsQuery.isFetching}
              onClick={() => {
                void movementsQuery.refetch();
              }}
            >
              {APP_MESSAGES.retry}
            </Button>
          }
        >
          {movementsQuery.error.message || SAVINGS_MESSAGES.movementsError}
        </Alert>
      ) : movementsQuery.isPending ? (
        <div className="space-y-3" aria-busy="true">
          {[1, 2].map((row) => (
            <div
              key={row}
              className="h-14 animate-pulse rounded-[var(--radius-md)] bg-surface-subtle/70"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-4 text-sm text-text-secondary">{SAVINGS_MESSAGES.movementsEmpty}</p>
      ) : (
        <>
          <MovementList movements={items} hideAmounts={hideAmounts} />
          {movementsQuery.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="secondary"
                loading={movementsQuery.isFetchingNextPage}
                loadingLabel={SAVINGS_MESSAGES.movementsLoadingMore}
                onClick={() => {
                  void movementsQuery.fetchNextPage();
                }}
              >
                {SAVINGS_MESSAGES.movementsLoadMore}
              </Button>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}
