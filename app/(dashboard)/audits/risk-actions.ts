"use server";

import {
  createRiskEntry,
  getRiskEntries,
  getRiskMatrixData,
  getRiskTrends,
  linkRiskToIncident,
  unlinkRiskFromIncident,
  updateRiskEntry,
} from "./actions";

export {
  getRiskEntries,
  createRiskEntry,
  updateRiskEntry,
  linkRiskToIncident,
  unlinkRiskFromIncident,
  getRiskMatrixData,
  getRiskTrends,
};
