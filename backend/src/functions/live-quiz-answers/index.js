import { HttpError } from '../../http/errors.js';
import { LiveQuizRepository } from '../../repositories/live-quiz-repository.js';

const discardableCodes = new Set(['LIVE_QUESTION_NOT_OPEN', 'LIVE_QUESTION_LOCKED', 'LIVE_QUESTION_CHANGED', 'LIVE_ANSWER_ALREADY_RECEIVED', 'NOT_FOUND']);

export function createLiveQuizAnswerProcessor({ answerRepository, logger = console } = {}) {
  return async function processLiveQuizAnswers(event) {
    const repository = answerRepository || new LiveQuizRepository({ quizRepository: {} });
    const batchItemFailures = [];
    let processed = 0;
    let discarded = 0;
    let retry = 0;
    const records = event?.Records || [];
    for (const record of records) {
      try {
        const body = JSON.parse(record.body || '{}');
        await repository.processQueuedAnswer(body);
        processed += 1;
      } catch (caught) {
        if (caught instanceof HttpError && discardableCodes.has(caught.code)) {
          discarded += 1;
          logger.warn(JSON.stringify({ function: 'live-quiz-answer-processor', messageId: record.messageId, outcome: 'discarded', errorCode: caught.code }));
          continue;
        }
        retry += 1;
        logger.error(JSON.stringify({ function: 'live-quiz-answer-processor', messageId: record.messageId, outcome: 'retry' }));
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
    logger.info?.(JSON.stringify({ function: 'live-quiz-answer-processor', outcome: 'batch-summary', records: records.length, processed, discarded, retry }));
    return { batchItemFailures };
  };
}

export const handler = createLiveQuizAnswerProcessor();
