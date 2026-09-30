const challengeDefinitions = [
  { id: 'look_left', instruction: 'Putar kepala perlahan ke kiri Anda.', complete: (yaw) => yaw <= -12 },
  { id: 'look_right', instruction: 'Putar kepala perlahan ke kanan Anda.', complete: (yaw) => yaw >= 12 },
];

export function createFaceChallenge(random = Math.random) {
  return challengeDefinitions[Math.floor(random() * challengeDefinitions.length)] || challengeDefinitions[0];
}

export function isChallengeComplete(challenge, yaw) {
  return Boolean(challenge?.complete?.(Number(yaw)));
}
