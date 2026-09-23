import { HttpError } from '../../http/errors.js';
import { LiveQuizRepository } from '../../repositories/live-quiz-repository.js';

const discardableCodes = new Set(['LIVE_QUESTION_NOT_OPEN', 'LIVE_QUESTION_LOCKED', 'LIVE_QUESTION_CHANGED', 'LIVE_ANSWER_ALREADY_RECEIVED', 'NOT_FOUND']);

export function createLiveQuizAnswerProcessor({ answerRepository, logger = console } = {}) {
  return async function processLiveQuizAnswers(event) {
    const repository = answerRepository || new LiveQuizRepository({ quizRepository: {} });
    const batchItemFailures = [];
    for (const record of event?.Records || []) {
      try {
        const body = JSON.parse(record.body || '{}');
        await repository.processQueuedAnswer(body);
      } catch (caught) {
        if (caught instanceof HttpError && discardableCodes.has(caught.code)) {
          logger.warn(JSON.stringify({ function: 'live-quiz-answer-processor', messageId: record.messageId, outcome: 'discarded', errorCode: caught.code }));
          continue;
        }
        logger.error(JSON.stringify({ function: 'live-quiz-answer-processor', messageId: record.messageId, outcome: 'retry' }));
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
    return { batchItemFailures };
  };
}

export const handler = createLiveQuizAnswerProcessor();
