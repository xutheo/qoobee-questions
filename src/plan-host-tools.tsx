import React, { useEffect, useState } from 'react';
import { PLAN_GAMES, adjustPlanScore, nextGame, skipGame, type Plan } from '../shared/plan';

export function PlanHostTools({ s, act }: { s: Plan; act: (change: (draft: Plan) => void) => void }) {
  const [navigation, setNavigation] = useState(false);
  const [team, setTeam] = useState(0);
  const [scope, setScope] = useState<'overall' | 'game'>('overall');
  const [operation, setOperation] = useState<'add' | 'set'>('add');
  const [amount, setAmount] = useState('0');
  const canAdjustGame = s.phase === 'play' || s.phase === 'ranking';
  const current = scope === 'overall' ? s.teams[team].score : s.points[team];

  useEffect(() => { setNavigation(false); }, [s.game, s.phase]);
  useEffect(() => { if (!canAdjustGame) setScope('overall'); }, [canAdjustGame]);

  return <section className="plan-host-tools" aria-label="Host game tools">
    <h3>Host tools</h3>
    {s.phase !== 'setup' && s.phase !== 'complete' && <>
      <button onClick={() => s.phase === 'result' ? act(nextGame) : setNavigation(!navigation)}>
        {s.game === 4 ? 'End gauntlet' : 'Next game'}
      </button>
      {navigation && <div className="plan-navigation-options">
        <p>{s.game === 4 ? 'Finish the final game.' : `Up next: ${PLAN_GAMES[s.remainingGames?.[0] ?? s.game + 1].name}.`}</p>
        {(s.phase === 'play' || s.phase === 'rules') && <button onClick={() => act(d => {
          if (d.bet) d.history.push(`${PLAN_GAMES[d.game].name}: unfinished spectator wager voided by host.`);
          d.bet = null;
          d.matchReady = false;
          d.deadline = null;
          d.phase = 'ranking';
        })}>Finish current game and award places</button>}
        <p>Skipping awards no placement points and voids outstanding wagers. Already settled scores stay. You can undo this.</p>
        <button onClick={() => act(skipGame)}>{s.game === 4 ? 'Skip final game and show totals' : 'Skip current game and continue'}</button>
        <button onClick={() => setNavigation(false)}>Cancel</button>
      </div>}
    </>}
    <details>
      <summary>Adjust points</summary>
      <div className="plan-fields">
        <label>Score to adjust<select value={scope} onChange={e => setScope(e.target.value as 'overall' | 'game')}>
          <option value="overall">Overall gauntlet</option>
          <option value="game" disabled={!canAdjustGame}>Current game · {PLAN_GAMES[s.game].name}</option>
        </select></label>
        <label>Team to adjust<select value={team} onChange={e => setTeam(Number(e.target.value))}>
          {s.teams.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
        </select></label>
        <p>Current score: <strong>{current.toLocaleString()}</strong></p>
        <label>Adjustment type<select value={operation} onChange={e => setOperation(e.target.value as 'add' | 'set')}>
          <option value="add">Add or subtract points</option>
          <option value="set">Set exact score</option>
        </select></label>
        <label>{operation === 'add' ? 'Points to add (negative to subtract)' : 'New score'}
          <input type="number" step={scope === 'game' ? 0.5 : 1} value={amount} onChange={e => setAmount(e.target.value)} />
        </label>
        <button onClick={() => act(d => {
          const input = amount.trim() === '' ? NaN : Number(amount);
          const before = scope === 'overall' ? d.teams[team].score : d.points[team];
          adjustPlanScore(d, team, scope, operation === 'add' ? before + input : input);
        })}>Apply point adjustment</button>
      </div>
    </details>
  </section>;
}
