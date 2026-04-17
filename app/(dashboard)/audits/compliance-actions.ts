"use server";

import {
  createComplianceDoc,
  deleteComplianceDoc,
  getComplianceDashboardData,
  getComplianceDocs,
  getDocumentReadStatus,
  getExpiringDocuments,
  recordReadReceipt,
  updateComplianceDoc,
} from "./actions";

export {
  getComplianceDocs,
  createComplianceDoc,
  updateComplianceDoc,
  deleteComplianceDoc,
  recordReadReceipt,
  getDocumentReadStatus,
  getExpiringDocuments,
  getComplianceDashboardData,
};
