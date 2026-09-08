import { crudRouter } from './crudRouter.js';
import { spacesService } from '../services/spacesService.js';

export default crudRouter(spacesService);
