import { authenticateRequest } from '../../middleware/firebase-auth.js';
import { AttendanceRepository } from '../../repositories/attendance-repository.js';
import { ClassRepository } from '../../repositories/class-repository.js';
import { DiscussionRepository } from '../../repositories/discussion-repository.js';
import { MaterialRepository } from '../../repositories/material-repository.js';
import { createAttendanceHandler } from '../attendance/handler.js';
import { createDiscussionsHandler } from '../discussions/handler.js';
import { createMaterialsHandler } from '../materials/handler.js';
import { createClassesHandler } from './handler.js';

const classRepository = new ClassRepository();
const materialRepository = new MaterialRepository({ classRepository });
const discussionRepository = new DiscussionRepository({ materialRepository });
const attendanceRepository = new AttendanceRepository({ classRepository });

const classesHandler = createClassesHandler({ authenticate: authenticateRequest, repository: classRepository });
const materialsHandler = createMaterialsHandler({ authenticate: authenticateRequest, repository: materialRepository });
const discussionsHandler = createDiscussionsHandler({ authenticate: authenticateRequest, repository: discussionRepository });
const attendanceHandler = createAttendanceHandler({ authenticate: authenticateRequest, repository: attendanceRepository });

export function handler(event, context) {
  const path = event?.rawPath || event?.path || '/';
  if (path.includes('/attendance')) return attendanceHandler(event, context);
  if (path.includes('/discussions')) return discussionsHandler(event, context);
  return path.includes('/materials') || path.startsWith('/learning/')
    ? materialsHandler(event, context)
    : classesHandler(event, context);
}
