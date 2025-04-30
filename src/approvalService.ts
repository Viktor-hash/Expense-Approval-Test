import { users, IUser } from './users';

interface IExpense {
  submitter_uid: number;
  amount: number;
  approvals: number[];
  status: 'pending' | 'approved' | 'rejected';
  flow: (number | number[])[];
  rejected_by?: number;
}

class ApprovalService {
  private users: IUser[];
  private userMap: Record<number, IUser>;
  private threshold: number;
  private expenses: Record<string, IExpense>;

  constructor(users: IUser[], threshold: number = 1000) {
    this.users = users;
    this.userMap = Object.fromEntries(users.map(user => [user.uid, user]));
    this.threshold = threshold;
    this.expenses = {};
  }

  start_approval(expense_id: string, submitter_uid: number, amount: number): void {
    if (this.expenses[expense_id]) {
      throw new Error('Expense already exists');
    }

    const flow = this.buildApprovalFlow(submitter_uid, amount);

    this.expenses[expense_id] = {
      submitter_uid,
      amount,
      approvals: [],
      status: 'pending',
      flow
    };
  }

  private buildApprovalFlow(submitter_uid: number, amount: number): (number | number[])[] {
    const flow: (number | number[])[] = [];
    const boss = this.userMap[submitter_uid]?.manager;

    if (!boss) {
      throw new Error('Submitter has no manager');
    }

    if (boss !== submitter_uid) { // No need to approve for himself
      flow.push(boss);

      if (amount > this.threshold) {
        const bossBoss = this.userMap[boss]?.manager;
        if (bossBoss && bossBoss !== boss) {
          flow.push(bossBoss);
        }
      }
    }

    const financeApprovers = this.users
      .filter(user => user.email.endsWith('@approve.com'))
      .map(user => user.uid);

    flow.push(financeApprovers);
    return flow;
  }

  next_approvers(expense_id: string): number[] {
    const expense = this.expenses[expense_id];
    if (!expense || expense.status !== 'pending') {
      return [];
    }

    const currentStep = expense.approvals.length;
    const nextStep = expense.flow[currentStep];

    return Array.isArray(nextStep) ? nextStep : [nextStep];
  }

  approve(expense_id: string, approver_uid: number): void {
    const expense = this.expenses[expense_id];
    if (!expense || expense.status !== 'pending') {
      throw new Error('Invalid expense');
    }

    const next = this.next_approvers(expense_id);
    if (!next.includes(approver_uid)) {
      throw new Error('User not authorized to approve');
    }

    expense.approvals.push(approver_uid);

    if (expense.approvals.length === expense.flow.length) {
      expense.status = 'approved';
    }
  }

  reject(expense_id: string, approver_uid: number): void {
    const expense = this.expenses[expense_id];
    if (!expense || expense.status !== 'pending') {
      throw new Error('Invalid expense');
    }

    expense.status = 'rejected';
    expense.rejected_by = approver_uid;
  }

  dump_flow(expense_id: string): void {
    const expense = this.expenses[expense_id];
    if (!expense) {
      console.log('No such expense');
      return;
    }

    console.log(`Expense ID: ${expense_id}`);
    console.log(`Submitter: ${expense.submitter_uid}, Amount: ${expense.amount}`);
    console.log(`Status: ${expense.status}`);
    console.log('Approvals so far: ', expense.approvals);
    console.log('Full Flow: ', expense.flow);
    if (expense.status === 'rejected') {
      console.log(`Rejected by: ${expense.rejected_by}`);
    }
  }
}

// Example usage
const service = new ApprovalService(users);

try {
  service.start_approval('EXP123', 1, 1500);
  console.log('Next approvers:', service.next_approvers('EXP123'));
  service.approve('EXP123', service.next_approvers('EXP123')[0]); // First approver
  console.log('Next approvers:', service.next_approvers('EXP123'));
  service.approve('EXP123', service.next_approvers('EXP123')[0]); // Second approver
  console.log('Next approvers:', service.next_approvers('EXP123'));
  service.approve('EXP123', service.next_approvers('EXP123')[0]); // Finance approver
  service.dump_flow('EXP123');
} catch (err) {
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error('An unknown error occurred');
  }
}

export default ApprovalService;