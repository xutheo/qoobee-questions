// Independent audience puzzles, indexed by clue row (100–500 difficulty).
export const audienceBombs = [
 {items:['Blue moon','Orange sun','Pink star'], hints:['Cut the sun first.','Cut the moon second.','Cut the star last.'], solution:['Orange sun','Blue moon','Pink star']},
 {items:['White key','Purple crown','Cyan bell','Orange leaf'], hints:['Leave the leaf intact.','The key is cut immediately after the bell.','The crown is the final cut.'], solution:['Cyan bell','White key','Purple crown']},
 {items:['Pink comet','White cloud','Orange flame','Cyan wave'], hints:['Cut all four wires.','The cloud comes immediately before the wave.','The flame is after the wave but before the comet.'], solution:['White cloud','Cyan wave','Orange flame','Pink comet']},
 {items:['Purple diamond','Orange circle','White triangle','Cyan square','Pink star'], hints:['Leave the shape with three sides intact.','Cut the shape with no corners first.','The star comes immediately before the square.','The diamond is the final cut.'], solution:['Orange circle','Pink star','Cyan square','Purple diamond']},
 {items:['White 8','Cyan 3','Purple 6','Orange 5','Pink 2'], hints:['Leave the only number divisible by four intact.','Cut all remaining numbers.','The first two cuts sum to seven.','The third cut is the only remaining even number.','The smaller of the first two numbers is cut first.'], solution:['Pink 2','Orange 5','Purple 6','Cyan 3']}
];
