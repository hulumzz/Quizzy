import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export class LiveQuizAnswerQueue {
  constructor({ queueUrl = process.env.QUIZ_ANSWER_QUEUE_URL, client } = {}) {
    if (!queueUrl) throw new Error('QUIZ_ANSWER_QUEUE_URL is required');
    this.queueUrl = queueUrl;
    this.client = client || new SQSClient({});
  }

  async enqueue(answer) {
    await this.client.send(new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(answer),
    }));
    return { accepted: true, acceptedAt: answer.acceptedAt };
  }
}
