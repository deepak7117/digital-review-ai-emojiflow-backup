import type { Industry, SegmentConfig } from "./types";

/**
 * Milestone A industries — just the 7 needed to host the 10 representative
 * segments below. The full ~20-industry / ~1,000-segment target is future
 * work (see project instructions: "Do not artificially create meaningless
 * segments just to reach 1,000" and "First create and verify... 10
 * representative segments... Once this milestone is verified, STOP").
 */
export const INDUSTRIES: Industry[] = [
  { slug: "food-beverage", name: "Food & Beverage" },
  { slug: "retail", name: "Retail" },
  { slug: "beauty-wellness", name: "Beauty & Wellness" },
  { slug: "healthcare", name: "Healthcare" },
  { slug: "fitness", name: "Fitness" },
  { slug: "automotive", name: "Automotive" },
  { slug: "professional-services", name: "Professional Services" },
];

export const SEGMENTS: SegmentConfig[] = [
  {
    industrySlug: "food-beverage",
    segmentSlug: "restaurant",
    displayName: "Restaurant",
    description: "Full-service dine-in restaurant.",
    customerTerminology: "guests",
    feedbackTags: {
      positive: ["Taste", "Food Quality", "Staff Behaviour", "Ambience", "Cleanliness", "Value"],
      negative: ["Waiting Time", "Service Delay", "Parking", "Pricing", "Delivery Delay", "Food Quality"],
    },
    metrics: [
      { key: "food_quality", label: "Food Quality" },
      { key: "service_speed", label: "Service Speed" },
      { key: "ambience", label: "Ambience" },
      { key: "value", label: "Value for Money" },
    ],
    pulseQuestionTemplates: [
      { question: "How was your food?", options: ["Excellent", "Good", "Average", "Poor"] },
      { question: "How was the waiting time?", options: ["Fast", "Reasonable", "Slow", "Very slow"] },
      { question: "How likely are you to return?", options: ["Very likely", "Likely", "Unsure", "Unlikely"] },
    ],
    customerQuestions: [
      "Why are customers unhappy?",
      "What should I fix this week?",
      "Which dish gets the most praise?",
    ],
    recommendationRules: [
      {
        watchesTag: "Waiting Time",
        title: "Investigate peak-hour service delays",
        action: "Review staffing and table turnover during peak hours.",
      },
      {
        watchesTag: "Food Quality",
        title: "Review kitchen quality control",
        action: "Audit recipe consistency and ingredient freshness with the kitchen team.",
      },
      {
        watchesTag: "Staff Behaviour",
        title: "Address staff behaviour concerns",
        action: "Review recent service interactions and reinforce guest-service training.",
      },
      {
        watchesTag: "Cleanliness",
        title: "Review cleanliness standards",
        action: "Audit dining area and restroom cleaning schedules.",
      },
      {
        watchesTag: "Delivery Delay",
        title: "Investigate delivery delays",
        action: "Review delivery partner performance and kitchen-to-dispatch handoff times.",
      },
    ],
  },
  {
    industrySlug: "food-beverage",
    segmentSlug: "cafe",
    displayName: "Café",
    description: "Coffee shop / café with light food.",
    customerTerminology: "guests",
    feedbackTags: {
      positive: ["Coffee Quality", "Staff Behaviour", "Ambience", "Cleanliness", "Wifi"],
      negative: ["Waiting Time", "Seating Availability", "Pricing", "Noise Level"],
    },
    metrics: [
      { key: "coffee_quality", label: "Coffee Quality" },
      { key: "ambience", label: "Ambience" },
      { key: "seating", label: "Seating Availability" },
    ],
    pulseQuestionTemplates: [
      { question: "How was your coffee?", options: ["Excellent", "Good", "Average", "Poor"] },
      {
        question: "What should we bring next?",
        options: ["More seating", "Later hours", "New menu items", "Loyalty rewards"],
      },
    ],
    customerQuestions: ["What do customers love most?", "Why are customers not returning?"],
    recommendationRules: [
      {
        watchesTag: "Seating Availability",
        title: "Review seating capacity at peak times",
        action: "Consider layout changes or a queueing system during busy hours.",
      },
    ],
  },
  {
    industrySlug: "retail",
    segmentSlug: "grocery",
    displayName: "Grocery / Supermarket",
    description: "Grocery store or supermarket.",
    customerTerminology: "shoppers",
    feedbackTags: {
      positive: ["Product Range", "Freshness", "Staff Behaviour", "Store Cleanliness", "Value"],
      negative: ["Stock Availability", "Checkout Wait", "Pricing", "Store Cleanliness"],
    },
    metrics: [
      { key: "stock_availability", label: "Stock Availability" },
      { key: "checkout_speed", label: "Checkout Speed" },
      { key: "freshness", label: "Freshness" },
    ],
    pulseQuestionTemplates: [
      {
        question: "Which category should we expand?",
        options: ["Fresh produce", "Packaged goods", "Household items", "Personal care"],
      },
    ],
    customerQuestions: ["What is my biggest customer problem?", "What do customers want but don't receive?"],
    recommendationRules: [
      {
        watchesTag: "Stock Availability",
        title: "Review inventory for frequently out-of-stock items",
        action: "Check reorder thresholds for the most-requested products.",
      },
    ],
  },
  {
    industrySlug: "retail",
    segmentSlug: "fashion-store",
    displayName: "Fashion Store",
    description: "Apparel / clothing retail store.",
    customerTerminology: "customers",
    feedbackTags: {
      positive: ["Product Quality", "Staff Behaviour", "Store Ambience", "Size Range", "Value"],
      negative: ["Size Availability", "Colour Availability", "Pricing", "Trial Room Wait"],
    },
    metrics: [
      { key: "size_availability", label: "Size Availability" },
      { key: "style_satisfaction", label: "Style Satisfaction" },
    ],
    pulseQuestionTemplates: [
      {
        question: "What should we stock more of?",
        options: ["More sizes", "More colours", "Premium range", "Budget range"],
      },
    ],
    customerQuestions: ["What do customers repeatedly request?", "Which improvements should be prioritised?"],
    recommendationRules: [
      {
        watchesTag: "Size Availability",
        title: "Review size-range inventory",
        action: "Consider expanding stock in frequently requested sizes.",
      },
    ],
  },
  {
    industrySlug: "beauty-wellness",
    segmentSlug: "salon",
    displayName: "Salon",
    description: "Hair and beauty salon.",
    customerTerminology: "clients",
    feedbackTags: {
      positive: ["Service Quality", "Staff Behaviour", "Cleanliness", "Value", "Ambience"],
      negative: ["Waiting Time", "Pricing", "Booking Difficulty", "Staff Availability"],
    },
    metrics: [
      { key: "service_satisfaction", label: "Service Satisfaction" },
      { key: "staff_behaviour", label: "Staff Behaviour" },
      { key: "repeat_visit_intent", label: "Repeat Visit Intent" },
    ],
    pulseQuestionTemplates: [
      { question: "How was your service today?", options: ["Excellent", "Good", "Average", "Poor"] },
      {
        question: "What service should we add next?",
        options: ["Spa treatments", "Bridal packages", "Men's grooming", "Nail care"],
      },
    ],
    customerQuestions: ["Which service is performing best?", "Why are customers not returning?"],
    recommendationRules: [
      {
        watchesTag: "Waiting Time",
        title: "Review appointment scheduling",
        action: "Consider a booking buffer or additional staff during peak slots.",
      },
      {
        watchesTag: "Service Quality",
        title: "Review service quality standards",
        action: "Audit recent service outcomes and refresh technique training where needed.",
      },
      {
        watchesTag: "Staff Behaviour",
        title: "Address staff behaviour concerns",
        action: "Review recent client interactions and reinforce client-care training.",
      },
      {
        watchesTag: "Cleanliness",
        title: "Review hygiene standards",
        action: "Audit tool sterilization and station cleaning protocols.",
      },
      {
        watchesTag: "Booking Difficulty",
        title: "Simplify appointment booking",
        action: "Review the booking process for friction points, e.g. phone-only booking or limited slot visibility.",
      },
    ],
  },
  {
    industrySlug: "healthcare",
    segmentSlug: "dental-clinic",
    displayName: "Dental Clinic",
    description: "Dental practice / clinic.",
    customerTerminology: "patients",
    feedbackTags: {
      positive: ["Doctor Communication", "Treatment Explanation", "Cleanliness", "Staff Behaviour"],
      negative: ["Waiting Time", "Appointment Experience", "Pricing", "Follow-up Experience"],
    },
    metrics: [
      { key: "patient_experience", label: "Patient Experience" },
      { key: "waiting_time", label: "Waiting Time" },
      { key: "doctor_communication", label: "Doctor Communication" },
      { key: "treatment_explanation", label: "Treatment Explanation" },
      { key: "appointment_experience", label: "Appointment Experience" },
      { key: "follow_up_experience", label: "Follow-up Experience" },
    ],
    pulseQuestionTemplates: [
      {
        question: "What opening time works best for you?",
        options: ["Early morning", "Mid-day", "Evening", "Weekend"],
      },
    ],
    customerQuestions: ["Why are customers unhappy?", "If I fix only one thing this month, what should it be?"],
    recommendationRules: [
      {
        watchesTag: "Waiting Time",
        title: "Review appointment scheduling during peak hours",
        action: "Investigate scheduling gaps causing patient wait times.",
      },
      {
        watchesTag: "Appointment Experience",
        title: "Review the appointment booking process",
        action: "Audit confirmation, reminder, and rescheduling steps for friction points.",
      },
      {
        watchesTag: "Doctor Communication",
        title: "Improve doctor-patient communication",
        action: "Review consultation time allocation and communication approach with clinicians.",
      },
      {
        watchesTag: "Staff Behaviour",
        title: "Address staff behaviour concerns",
        action: "Review recent patient interactions and reinforce front-desk/chairside training.",
      },
      {
        watchesTag: "Treatment Explanation",
        title: "Improve treatment-plan explanations",
        action: "Standardize how treatment options and costs are explained before procedures.",
      },
    ],
  },
  {
    industrySlug: "fitness",
    segmentSlug: "gym",
    displayName: "Gym / Fitness Centre",
    description: "Gym or fitness centre.",
    customerTerminology: "members",
    feedbackTags: {
      positive: ["Equipment Quality", "Trainer Support", "Cleanliness", "Ambience", "Value"],
      negative: ["Equipment Availability", "Crowding", "Cleanliness", "Pricing"],
    },
    metrics: [
      { key: "equipment_availability", label: "Equipment Availability" },
      { key: "trainer_support", label: "Trainer Support" },
      { key: "cleanliness", label: "Cleanliness" },
    ],
    pulseQuestionTemplates: [
      {
        question: "What should we add next?",
        options: ["More equipment", "Group classes", "Extended hours", "Personal training"],
      },
    ],
    customerQuestions: ["What is causing complaints?", "Which improvements should be prioritised?"],
    recommendationRules: [
      {
        watchesTag: "Crowding",
        title: "Review peak-hour capacity",
        action: "Consider capacity limits or off-peak incentives.",
      },
    ],
  },
  {
    industrySlug: "automotive",
    segmentSlug: "automotive-service",
    displayName: "Automotive Service Centre",
    description: "Vehicle service and repair centre.",
    customerTerminology: "customers",
    feedbackTags: {
      positive: ["Service Quality", "Technician Behaviour", "Communication", "Pricing Transparency"],
      negative: ["Delivery Time", "Pricing", "Communication", "Repair Quality"],
    },
    metrics: [
      { key: "service_quality", label: "Service Quality" },
      { key: "technician_behaviour", label: "Technician Behaviour" },
      { key: "delivery_time", label: "Delivery Time" },
      { key: "communication", label: "Communication" },
      { key: "repair_satisfaction", label: "Repair Satisfaction" },
      { key: "repeat_service_intent", label: "Repeat Service Intent" },
    ],
    pulseQuestionTemplates: [
      {
        question: "What payment options would you like?",
        options: ["Card on delivery", "UPI", "Financing", "No change needed"],
      },
    ],
    customerQuestions: ["Why are customers not returning?", "What is my biggest customer problem?"],
    recommendationRules: [
      {
        watchesTag: "Delivery Time",
        title: "Investigate delayed vehicle handovers",
        action: "Review workshop scheduling and parts availability lead times.",
      },
      {
        watchesTag: "Communication",
        title: "Improve customer communication",
        action: "Set clear checkpoints for status updates during service (e.g. on arrival, mid-service, before handover).",
      },
      {
        watchesTag: "Repair Quality",
        title: "Review repair quality control",
        action: "Audit recent repair jobs for rework rates and root causes.",
      },
      {
        watchesTag: "Pricing Transparency",
        title: "Improve pricing transparency",
        action: "Provide itemized estimates before work begins and confirm before any additional charges.",
      },
    ],
  },
  {
    industrySlug: "professional-services",
    segmentSlug: "real-estate",
    displayName: "Real Estate Agency",
    description: "Real estate brokerage / agency.",
    customerTerminology: "clients",
    feedbackTags: {
      positive: ["Communication", "Market Knowledge", "Responsiveness", "Professionalism"],
      negative: ["Responsiveness", "Communication", "Follow-up", "Transparency"],
    },
    metrics: [
      { key: "responsiveness", label: "Responsiveness" },
      { key: "communication", label: "Communication" },
      { key: "follow_up", label: "Follow-up" },
    ],
    pulseQuestionTemplates: [
      {
        question: "Which service should we expand?",
        options: ["Buying support", "Selling support", "Rentals", "Property management"],
      },
    ],
    customerQuestions: ["What do clients love most?", "What should I fix this week?"],
    recommendationRules: [
      {
        watchesTag: "Follow-up",
        title: "Review client follow-up process",
        action: "Set a standard follow-up cadence after initial enquiries.",
      },
    ],
  },
  {
    industrySlug: "professional-services",
    segmentSlug: "professional-service",
    displayName: "Professional Service (General)",
    description: "General-purpose professional service provider (consulting, legal, accounting, etc.).",
    customerTerminology: "clients",
    feedbackTags: {
      positive: ["Expertise", "Communication", "Responsiveness", "Value"],
      negative: ["Responsiveness", "Pricing", "Communication", "Turnaround Time"],
    },
    metrics: [
      { key: "expertise", label: "Expertise" },
      { key: "responsiveness", label: "Responsiveness" },
      { key: "turnaround_time", label: "Turnaround Time" },
    ],
    pulseQuestionTemplates: [
      { question: "How was your experience?", options: ["Excellent", "Good", "Average", "Poor"] },
    ],
    customerQuestions: ["Why are customers unhappy?", "What should I fix this week?"],
    recommendationRules: [
      {
        watchesTag: "Turnaround Time",
        title: "Review case/project turnaround times",
        action: "Identify where handoffs or approvals are causing delays.",
      },
    ],
  },
];
