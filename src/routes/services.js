import { crudRouter } from './crudRouter.js';
import { servicesService } from '../services/servicesService.js';

export default crudRouter(servicesService);
