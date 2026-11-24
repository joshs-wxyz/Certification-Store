import { Certification } from '../models/certification';

/** Default catalog loaded on first visit (or after "Restore sample catalog"). */
export const SEED_CERTIFICATIONS: readonly Certification[] = [
  {
    id: 'aws-solutions-architect-associate',
    title: 'AWS Certified Solutions Architect – Associate',
    vendor: 'Amazon Web Services',
    level: 'Associate',
    shortDescription: 'Design resilient, secure, cost-optimized architectures on AWS.',
    description:
      'Validates the ability to design solutions on AWS that are secure, resilient, high-performing and cost-optimized, using the AWS Well-Architected Framework. Covers compute, storage, networking, databases, identity and access management, and choosing the right managed services for a workload.',
    intendedFor: ['Solutions architects', 'Cloud engineers', 'Developers moving into architecture roles'],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'azure-fundamentals',
    title: 'Microsoft Certified: Azure Fundamentals',
    vendor: 'Microsoft',
    level: 'Foundational',
    shortDescription: 'Core cloud concepts and the fundamentals of Microsoft Azure services.',
    description:
      'An entry-level certification covering cloud concepts (IaaS, PaaS, SaaS, shared responsibility), core Azure architecture and services, and Azure management and governance including cost management, compliance and identity basics.',
    intendedFor: ['Anyone new to cloud', 'Business and sales roles working with Azure', 'Technical staff starting an Azure path'],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'certified-kubernetes-administrator',
    title: 'Certified Kubernetes Administrator (CKA)',
    vendor: 'The Linux Foundation / CNCF',
    level: 'Professional',
    shortDescription: 'Hands-on, performance-based exam for running Kubernetes clusters.',
    description:
      'A performance-based exam where candidates solve tasks on live clusters. Covers cluster architecture and installation, workloads and scheduling, services and networking, storage, and troubleshooting of clusters and applications.',
    intendedFor: ['Platform and DevOps engineers', 'Site reliability engineers', 'Kubernetes cluster operators'],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'google-cloud-professional-cloud-architect',
    title: 'Google Cloud Professional Cloud Architect',
    vendor: 'Google Cloud',
    level: 'Professional',
    shortDescription: 'Design, plan and manage robust solutions on Google Cloud.',
    description:
      'Assesses the ability to design and plan cloud solution architecture, manage and provision infrastructure, design for security and compliance, analyze and optimize technical and business processes, and ensure solution and operations reliability on Google Cloud. Includes case-study based questions.',
    intendedFor: ['Cloud architects', 'Senior engineers designing Google Cloud solutions', 'Technical leads'],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pmp',
    title: 'Project Management Professional (PMP)',
    vendor: 'Project Management Institute',
    level: 'Professional',
    shortDescription: 'Globally recognized certification for experienced project managers.',
    description:
      'Validates competence across people, process and business environment domains, spanning predictive, agile and hybrid approaches. Candidates must meet project experience and education prerequisites before sitting the exam.',
    intendedFor: ['Project managers', 'Delivery leads', 'Program and portfolio coordinators'],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'istqb-foundation',
    title: 'ISTQB Certified Tester Foundation Level',
    vendor: 'ISTQB',
    level: 'Foundational',
    shortDescription: 'The foundation of software testing terminology and practice.',
    description:
      'Covers testing fundamentals, testing throughout the software development lifecycle, static testing, test analysis and design techniques, test management, and tool support for testing.',
    intendedFor: ['QA and test engineers', 'Developers who want a testing foundation', 'Business analysts and product owners'],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];
