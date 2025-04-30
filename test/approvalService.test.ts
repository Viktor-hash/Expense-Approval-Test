import { expect } from 'chai';
import sinon from 'sinon';
import ApprovalService from '../src/approvalService'; // Adjust the path if necessary
import { users } from '../src/users';

describe('ApprovalService', () => {
  let consoleSpy: sinon.SinonSpy<any[], void>;
  let service: ApprovalService;

  beforeEach(() => {
    service = new ApprovalService(users, 1000);
    consoleSpy = sinon.spy(console, 'log'); // Spy on console.log
  });

  afterEach(() => {
    consoleSpy.restore(); // Restore console.log after each test
  });

  it('should start an approval flow', () => {
    service.start_approval('EXP001', 1, 500);
    service.dump_flow('EXP001');

    // Verify console.log was called with the expected output
    expect(consoleSpy.calledWith('Expense ID: EXP001')).to.be.true;
    expect(consoleSpy.calledWith('Submitter: 1, Amount: 500')).to.be.true;
    expect(consoleSpy.calledWith('Status: pending')).to.be.true;
    expect(consoleSpy.calledWith('Approvals so far: ', [])).to.be.true;
    expect(consoleSpy.calledWith('Full Flow: ', [2, [6, 7, 8]])).to.be.true;
  });

  it('should return the next approvers', () => {
    service.start_approval('EXP002', 1, 1500);
    const nextApprovers = service.next_approvers('EXP002');
    expect(nextApprovers).to.deep.equal([2]);
  });

  it('should approve an expense step by step', () => {
    service.start_approval('EXP003', 1, 1500);
    service.approve('EXP003', 2); // Approve by boss
    expect(service.next_approvers('EXP003')).to.deep.equal([5]); // Boss's boss
    service.approve('EXP003', 5); // Approve by boss's boss
    expect(service.next_approvers('EXP003')).to.deep.equal([6, 7, 8]); // Finance approvers
    service.approve('EXP003', 6); // Approve by finance

    service.dump_flow('EXP003');

    expect(consoleSpy.calledWith('Expense ID: EXP003')).to.be.true;
    expect(consoleSpy.calledWith('Submitter: 1, Amount: 1500')).to.be.true;
    expect(consoleSpy.calledWith('Status: approved')).to.be.true;
    expect(consoleSpy.calledWith('Approvals so far: ', [2, 5, 6])).to.be.true;
    expect(consoleSpy.calledWith('Full Flow: ', [2, 5, [6, 7, 8]])).to.be.true;
  });

  it('should approve an expense step by step with auto approval', () => {
    service.start_approval('EXP003', 5, 1500);
    // As the submitter is the highest approver, auto-approval should happen
    expect(service.next_approvers('EXP003')).to.deep.equal([6, 7, 8]); // Finance approvers
    service.approve('EXP003', 6); // Approve by finance

    service.dump_flow('EXP003');

    expect(consoleSpy.calledWith('Expense ID: EXP003')).to.be.true;
    expect(consoleSpy.calledWith('Submitter: 5, Amount: 1500')).to.be.true;
    expect(consoleSpy.calledWith('Status: approved')).to.be.true;
    expect(consoleSpy.calledWith('Approvals so far: ', [6])).to.be.true;
    expect(consoleSpy.calledWith('Full Flow: ', [[6, 7, 8]])).to.be.true;
  });

  it('should approve an expense step by step below threshold', () => {
    service.start_approval('EXP003', 1, 900);
    service.approve('EXP003', 2); // Approve by boss
    expect(service.next_approvers('EXP003')).to.deep.equal([6, 7, 8]); // Finance approvers
    service.approve('EXP003', 6); // Approve by finance

    service.dump_flow('EXP003');

    expect(consoleSpy.calledWith('Expense ID: EXP003')).to.be.true;
    expect(consoleSpy.calledWith('Submitter: 1, Amount: 900')).to.be.true;
    expect(consoleSpy.calledWith('Status: approved')).to.be.true;
    expect(consoleSpy.calledWith('Approvals so far: ', [2, 6])).to.be.true;
    expect(consoleSpy.calledWith('Full Flow: ', [2, [6, 7, 8]])).to.be.true;
  });

  it('should reject an expense', () => {
    service.start_approval('EXP004', 1, 500);
    service.reject('EXP004', 2);
    service.dump_flow('EXP004');
    expect(consoleSpy.calledWith('Expense ID: EXP004')).to.be.true;
    expect(consoleSpy.calledWith('Submitter: 1, Amount: 500')).to.be.true;
    expect(consoleSpy.calledWith('Status: rejected')).to.be.true;
    expect(consoleSpy.calledWith('Rejected by: 2')).to.be.true;
  });

  it('should throw an error for invalid approvals', () => {
    service.start_approval('EXP005', 1, 500);
    expect(() => service.approve('EXP005', 3)).to.throw('User not authorized to approve');
  });

  it('should throw an error for duplicate expense IDs', () => {
    service.start_approval('EXP006', 1, 500);
    expect(() => service.start_approval('EXP006', 1, 500)).to.throw('Expense already exists');
  });

  it('should throw an error when approving an expense with an invalid user ID', () => {
    service.start_approval('EXP007', 1, 500);
    expect(() => service.approve('EXP007', 999)).to.throw('User not authorized to approve'); // Invalid user ID
  });

  it('should throw an error when rejecting an expense that has already been approved', () => {
    service.start_approval('EXP008', 1, 500);
    service.approve('EXP008', 2); // Approve by boss
    service.approve('EXP008', 6); // Approve by finance
    expect(() => service.reject('EXP008', 2)).to.throw('Invalid expense'); // Cannot reject an approved expense
  });
});