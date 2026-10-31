export const defaultRules = `Everyone gets a turn
One player from each team is selected for each question. Every teammate gets a fair chance before anyone is selected again.

15 seconds to answer
Only the selected players can buzz during the first 15 seconds. After the countdown, the question opens to everyone eligible to answer.

One buzz per team
If a member from your team has already answered, your team is locked out from answering again (unless the host allows you to re-buzz).

No talking during the countdown
Other team members must stay silent during the 15-second countdown.`;


export function parseRules(text: string) {
  return text.replace(/\r\n?/g, '\n').trim().split(/\n[ \t]*\n(?:[ \t]*\n)*/).filter(block => block.trim()).map(block => {
    const [heading, ...lines] = block.split('\n');
    return {heading: heading.trim(), body: lines.join('\n').trim()};
  });
}
