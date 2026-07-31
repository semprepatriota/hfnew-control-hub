import { createContext, useEffect, useMemo, useState } from 'react';
import { INSTRUMENTS } from '../services/instruments';

export const DataContext = createContext();

const defaultProfessionalProfile = {
  name: '',
  formation: '',
  cbo: '',
  phone: '',
  email: '',
};

const STORAGE_NAMESPACE = 'hfnew-psi:';

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const storageKey = (key) => `${STORAGE_NAMESPACE}${key}`;

const readStoredValue = (key) => (
  localStorage.getItem(storageKey(key)) ?? localStorage.getItem(key)
);

const readStoredList = (key) => {
  const value = readStoredValue(key);
  if (!value) return [];

  try {
    const parsedValue = JSON.parse(value);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (error) {
    console.error(`Erro ao carregar ${key}:`, error);
    localStorage.removeItem(storageKey(key));
    return [];
  }
};

const readStoredObject = (key, fallback) => {
  const value = readStoredValue(key);
  if (!value) return fallback;

  try {
    const parsedValue = JSON.parse(value);
    return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)
      ? { ...fallback, ...parsedValue }
      : fallback;
  } catch (error) {
    console.error(`Erro ao carregar ${key}:`, error);
    localStorage.removeItem(storageKey(key));
    return fallback;
  }
};

const writeStoredList = (key, value) => {
  localStorage.setItem(storageKey(key), JSON.stringify(value));
};

const writeStoredObject = (key, value) => {
  localStorage.setItem(storageKey(key), JSON.stringify(value));
};

export const DataProvider = ({ children }) => {
  const [patients, setPatients] = useState([]);
  const [applications, setApplications] = useState([]);
  const [hypotheses, setHypotheses] = useState([]);
  const [reports, setReports] = useState([]);
  const [professionalProfile, setProfessionalProfile] = useState(defaultProfessionalProfile);

  useEffect(() => {
    setPatients(readStoredList('patients'));

    const storedApplications = readStoredList('applications');
    const legacyEvaluations = readStoredList('evaluations');
    setApplications(storedApplications.length > 0 ? storedApplications : legacyEvaluations.map((item) => ({
      ...item,
      status: item.status || 'completed',
      results: item.results || [{
        id: makeId('result'),
        area: 'Resultado legado',
        score: Number(item.score) || 0,
        maximum: '',
        percentage: '',
        classification: 'Nao classificado',
        observation: item.observations || '',
      }],
    })));
    setHypotheses(readStoredList('hypotheses'));
    setReports(readStoredList('reports'));
    setProfessionalProfile(readStoredObject('professionalProfile', defaultProfessionalProfile));
  }, []);

  const addPatient = (patientData) => {
    const now = new Date().toISOString();
    const newPatient = {
      id: makeId('patient'),
      ...patientData,
      status: 'in_progress',
      createdAt: now,
      updatedAt: now,
    };
    const updatedPatients = [...patients, newPatient];
    setPatients(updatedPatients);
    writeStoredList('patients', updatedPatients);
    return newPatient;
  };

  const updatePatient = (patientId, updatedData) => {
    const updatedPatients = patients.map((patient) => (
      patient.id === patientId
        ? { ...patient, ...updatedData, updatedAt: new Date().toISOString() }
        : patient
    ));
    setPatients(updatedPatients);
    writeStoredList('patients', updatedPatients);
  };

  const deletePatient = (patientId) => {
    const updatedPatients = patients.filter((patient) => patient.id !== patientId);
    const updatedApplications = applications.filter((application) => application.patientId !== patientId);
    const updatedHypotheses = hypotheses.filter((item) => item.patientId !== patientId);
    const updatedReports = reports.filter((report) => report.patientId !== patientId);

    setPatients(updatedPatients);
    setApplications(updatedApplications);
    setHypotheses(updatedHypotheses);
    setReports(updatedReports);
    writeStoredList('patients', updatedPatients);
    writeStoredList('applications', updatedApplications);
    writeStoredList('evaluations', updatedApplications);
    writeStoredList('hypotheses', updatedHypotheses);
    writeStoredList('reports', updatedReports);
  };

  const saveApplication = (applicationData, status = 'draft') => {
    const now = new Date().toISOString();
    const newApplication = {
      id: makeId('application'),
      ...applicationData,
      status,
      createdAt: now,
      updatedAt: now,
      completedAt: status === 'completed' ? now : null,
    };
    const updatedApplications = [...applications, newApplication];
    setApplications(updatedApplications);
    writeStoredList('applications', updatedApplications);
    writeStoredList('evaluations', updatedApplications);
    return newApplication;
  };

  const updateApplication = (applicationId, applicationData, status = 'draft') => {
    const now = new Date().toISOString();
    const updatedApplications = applications.map((application) => (
      application.id === applicationId
        ? {
          ...application,
          ...applicationData,
          status,
          updatedAt: now,
          completedAt: status === 'completed' ? (application.completedAt || now) : null,
        }
        : application
    ));
    setApplications(updatedApplications);
    writeStoredList('applications', updatedApplications);
    writeStoredList('evaluations', updatedApplications);
    return updatedApplications.find((application) => application.id === applicationId);
  };

  const deleteApplications = (applicationIds) => {
    const ids = new Set(Array.from(applicationIds || []).filter(Boolean));
    if (!ids.size) return 0;

    const updatedApplications = applications.filter((application) => !ids.has(application.id));
    const removedCount = applications.length - updatedApplications.length;
    if (!removedCount) return 0;

    const updatedReports = reports.map((report) => (
      Array.isArray(report.applicationIds)
        ? { ...report, applicationIds: report.applicationIds.filter((id) => !ids.has(id)), updatedAt: new Date().toISOString() }
        : report
    ));

    setApplications(updatedApplications);
    setReports(updatedReports);
    writeStoredList('applications', updatedApplications);
    writeStoredList('evaluations', updatedApplications);
    writeStoredList('reports', updatedReports);
    return removedCount;
  };

  const saveHypotheses = (patientId, selectedHypotheses, notes) => {
    const nextRecord = {
      id: makeId('hypotheses'),
      patientId,
      selected: selectedHypotheses,
      notes,
      updatedAt: new Date().toISOString(),
    };
    const updatedHypotheses = [
      ...hypotheses.filter((item) => item.patientId !== patientId),
      nextRecord,
    ];
    setHypotheses(updatedHypotheses);
    writeStoredList('hypotheses', updatedHypotheses);
    return nextRecord;
  };

  const saveReportDraft = (patientId, reportData) => {
    const now = new Date().toISOString();
    const newReport = {
      id: makeId('report'),
      patientId,
      ...reportData,
      status: 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const updatedReports = [...reports, newReport];
    setReports(updatedReports);
    writeStoredList('reports', updatedReports);
    return newReport;
  };

  const saveProfessionalProfile = (profileData) => {
    const updatedProfile = { ...defaultProfessionalProfile, ...profileData };
    setProfessionalProfile(updatedProfile);
    writeStoredObject('professionalProfile', updatedProfile);
    return updatedProfile;
  };

  const getPatientApplications = (patientId) => (
    applications
      .filter((application) => application.patientId === patientId)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
  );

  const value = useMemo(() => ({
    patients,
    tests: INSTRUMENTS,
    instruments: INSTRUMENTS,
    applications,
    evaluations: applications,
    hypotheses,
    reports,
    professionalProfile,
    addPatient,
    updatePatient,
    deletePatient,
    saveApplication,
    updateApplication,
    deleteApplications,
    saveEvaluation: saveApplication,
    saveHypotheses,
    saveReportDraft,
    saveProfessionalProfile,
    getPatientApplications,
    getPatientEvaluations: getPatientApplications,
  }), [patients, applications, hypotheses, reports, professionalProfile]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
