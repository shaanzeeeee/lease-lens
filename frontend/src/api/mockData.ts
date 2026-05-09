export const mockDashboardData = {
  total_properties: 12,
  total_documents: 432,
  active_deals: 5,
  pending_verification: 8,
  top_properties: [
    {
      id: 1,
      name: "The Grandeur Tower",
      address: "123 Main St",
      city: "New York",
      unit_count: 450,
      deal_count: 3,
      photo_urls: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80"]
    },
    {
      id: 2,
      name: "Oasis Apartments",
      address: "456 Sunset Blvd",
      city: "Los Angeles",
      unit_count: 220,
      deal_count: 1,
      photo_urls: ["https://images.unsplash.com/photo-1515263487990-61b07816b324?auto=format&fit=crop&w=400&q=80"]
    },
    {
      id: 3,
      name: "Metro Central",
      address: "789 Downtown Ave",
      city: "Chicago",
      unit_count: 310,
      deal_count: 5,
      photo_urls: ["https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80"]
    }
  ],
  recent_deals: [
    {
      id: 1,
      deal_name: "Grandeur - Q3 Underwriting",
      stage: "complete",
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      deal_name: "Oasis - Refinancing Model",
      stage: "validation",
      created_at: new Date(Date.now() - 86400000).toISOString()
    }
  ]
};

export const mockPropertiesData = [
  {
    id: 1,
    name: "The Grandeur Tower",
    address: "123 Main St",
    city: "New York",
    state: "NY",
    zip_code: "10001",
    property_type: "Multifamily",
    unit_count: 450,
    square_footage: 400000,
    photo_urls: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80", "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80"],
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    name: "Oasis Apartments",
    address: "456 Sunset Blvd",
    city: "Los Angeles",
    state: "CA",
    zip_code: "90028",
    property_type: "Multifamily",
    unit_count: 220,
    square_footage: 200000,
    photo_urls: ["https://images.unsplash.com/photo-1515263487990-61b07816b324?auto=format&fit=crop&w=400&q=80", "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&q=80"],
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    name: "Metro Central",
    address: "789 Downtown Ave",
    city: "Chicago",
    state: "IL",
    zip_code: "60601",
    property_type: "Multifamily",
    unit_count: 310,
    square_footage: 280000,
    photo_urls: ["https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80"],
    created_at: new Date().toISOString()
  }
];

export const mockDetailedProperties: Record<number, any> = {
  1: {
    ...mockPropertiesData[0],
    deals: [
      { id: 1, deal_name: "Grandeur - Q3 Underwriting", stage: "complete", created_at: new Date().toISOString() },
      { id: 3, deal_name: "Grandeur - Acquisition Model", stage: "intake", created_at: new Date(Date.now() - 400000000).toISOString() }
    ],
    documents: [
      { id: 1, filename: "RentRoll_Q3_Grandeur.pdf", file_type: "application/pdf", category: "rent_roll", status: "processed", extracted_data: { noi: 4500000, cap_rate: 5.8 } },
      { id: 2, filename: "T12_Operating_Statement.xlsx", file_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", category: "operating_statement", status: "processed" },
      { id: 3, filename: "Property_Tax_Assessment.pdf", file_type: "application/pdf", category: "tax_document", status: "validation" }
    ],
    apartments: [
      { id: 101, unit_number: "1A", beds: 2, baths: 2, square_feet: 1200, rent: 3500, status: "occupied" },
      { id: 102, unit_number: "1B", beds: 1, baths: 1, square_feet: 850, rent: 2800, status: "vacant" },
      { id: 103, unit_number: "PH1", beds: 3, baths: 3.5, square_feet: 2500, rent: 8500, status: "occupied" }
    ]
  },
  2: {
    ...mockPropertiesData[1],
    deals: [
      { id: 2, deal_name: "Oasis - Refinancing Model", stage: "validation", created_at: new Date(Date.now() - 86400000).toISOString() }
    ],
    documents: [
      { id: 4, filename: "Oasis_Rent_Roll_Current.pdf", file_type: "application/pdf", category: "rent_roll", status: "processed" },
      { id: 5, filename: "Insurance_Policy_2026.pdf", file_type: "application/pdf", category: "insurance", status: "pending" }
    ],
    apartments: [
      { id: 201, unit_number: "101", beds: 1, baths: 1, square_feet: 700, rent: 2100, status: "occupied" },
      { id: 202, unit_number: "102", beds: 2, baths: 1, square_feet: 950, rent: 2900, status: "occupied" }
    ]
  },
  3: {
    ...mockPropertiesData[2],
    deals: [],
    documents: [],
    apartments: []
  }
};

export const getMockPropertyDetail = (id: number) => {
  return mockDetailedProperties[id] || mockDetailedProperties[1];
};

export const mockChatResponse = {
  response: "Based on the recent data, the Grandeur Tower has maintained a steady occupancy rate of 95% over the past quarter. Its current Cap Rate is approximately 5.8%. Would you like me to generate a full underwriting report for this asset?",
  sources: [
    { filename: "Grandeur_Underwriting_Q3.pdf" }
  ]
};
