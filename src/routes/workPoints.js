import { crudRouter } from './crudRouter.js';
import { workPointsService } from '../services/workPointsService.js';

export default crudRouter(workPointsService);
