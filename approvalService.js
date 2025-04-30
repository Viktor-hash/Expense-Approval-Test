const users = require('./users');

class ApprovalService {
  constructor(users, threshold = 1000) {
    this.users = users;
    this.userMap = Object.fromEntries(users.map(user => [user.uid, user]));
    this.threshold = threshold;
    this.expenses = {}; // Move expenses inside the class
  }

  start_approval(expense_id, submitter_uid, amount) {
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

  buildApprovalFlow(submitter_uid, amount) {
    const flow = [];
    // if the submitter exists get his manager
    const boss = this.userMap[submitter_uid]?.manager;

    // if the boss is null, throw an error
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

    // This could be improved in the future to avoid redundant checks
    const financeApprovers = this.users
      .filter(user => user.email.endsWith('@approve.com'))
      .map(user => user.uid);

    flow.push(financeApprovers);
    return flow;
  }

  next_approvers(expense_id) {
    const expense = this.expenses[expense_id];
    if (!expense || expense.status !== 'pending') {
      return [];
    }

    const currentStep = expense.approvals.length;
    const nextStep = expense.flow[currentStep];

    return Array.isArray(nextStep) ? nextStep : [nextStep];
  }

  approve(expense_id, approver_uid) {
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

  reject(expense_id, approver_uid) {
    const expense = this.expenses[expense_id];
    if (!expense || expense.status !== 'pending') {
      throw new Error('Invalid expense');
    }

    expense.status = 'rejected';
    expense.rejected_by = approver_uid;
  }

  dump_flow(expense_id) {
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
  console.error(err.message);
}

module.exports = ApprovalService;