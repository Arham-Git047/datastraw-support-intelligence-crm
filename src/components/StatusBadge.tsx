import { TicketStatus, TicketPriority } from '../types';
export function StatusBadge({status}:{status:TicketStatus}){return <span className={`badge status-${status.toLowerCase().replace(' ','-')}`}>{status}</span>}
export function PriorityBadge({priority}:{priority:TicketPriority}){return <span className={`badge priority-${priority.toLowerCase()}`}>{priority}</span>}
