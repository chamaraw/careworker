"use server";

import {
  completeSupervision,
  createStaffDocument,
  createSupervisionSchedule,
  createTrainingRequirement,
  getExpiringStaffDocuments,
  getStaffDocuments,
  getStaffTrainingRecords,
  getSupervisionSchedules,
  getTrainingMatrix,
  getTrainingRequirements,
  getWorkforceComplianceData,
  recordTrainingCompletion,
  updateStaffDocument,
  updateTrainingRequirement,
  verifyStaffDocument,
} from "./actions";

export {
  getTrainingRequirements,
  createTrainingRequirement,
  updateTrainingRequirement,
  getStaffTrainingRecords,
  recordTrainingCompletion,
  getTrainingMatrix,
  getStaffDocuments,
  createStaffDocument,
  updateStaffDocument,
  verifyStaffDocument,
  getSupervisionSchedules,
  createSupervisionSchedule,
  completeSupervision,
  getWorkforceComplianceData,
  getExpiringStaffDocuments,
};
