/**
 * classifier.js
 * Classifies a guest message into one of 6 query types
 * based on keyword matching. Returns the first match found,
 * ordered from most specific to most general.
 */

// Each entry has a query_type and an array of keywords/phrases to match against
const CLASSIFICATION_RULES = [
  {
    query_type: 'complaint',
    keywords: [
      'not working', 'broken', 'unacceptable', 'terrible', 'horrible',
      'disgusting', 'refund', 'complaint', 'unhappy', 'disappointed',
      'no hot water', 'no water', 'no electricity', 'no power', 'no wifi',
      'dirty', 'filthy', 'smell', 'bug', 'insect', 'cockroach',
      'not clean', 'issue', 'problem', 'worst', 'awful'
    ]
  },
  {
    query_type: 'pre_sales_availability',
    keywords: [
      'available', 'availability', 'free', 'vacant', 'book',
      'booking', 'reserve', 'reservation', 'dates', 'nights',
      'check in', 'check-in', 'check out', 'check-out', 'arrive',
      'arrival', 'departure', 'from', 'to', 'between', 'stay'
    ]
  },
  {
    query_type: 'pre_sales_pricing',
    keywords: [
      'price', 'pricing', 'rate', 'rates', 'cost', 'charge',
      'how much', 'fee', 'fees', 'tariff', 'per night', 'total',
      'discount', 'offer', 'deal', 'package', 'inr', 'rupee', 'rupees', '₹'
    ]
  },
  {
    query_type: 'post_sales_checkin',
    keywords: [
      'wifi', 'wi-fi', 'password', 'check in time', 'check-in time',
      'what time', 'arrival time', 'key', 'access', 'directions',
      'how to reach', 'address', 'location', 'caretaker', 'contact',
      'early check', 'late check', 'instructions'
    ]
  },
  {
    query_type: 'special_request',
    keywords: [
      'early check-in', 'early checkin', 'late check-out', 'late checkout',
      'airport', 'transfer', 'pickup', 'drop', 'cab', 'taxi',
      'chef', 'cook', 'meal', 'breakfast', 'lunch', 'dinner', 'food',
      'birthday', 'anniversary', 'decoration', 'surprise', 'special',
      'extra bed', 'cot', 'baby', 'infant'
    ]
  },
  {
    query_type: 'general_enquiry',
    keywords: [
      'pet', 'pets', 'dog', 'cat', 'animal',
      'parking', 'car', 'vehicle',
      'pool', 'swim', 'swimming',
      'amenities', 'amenity', 'facilities', 'gym', 'spa',
      'beach', 'nearby', 'restaurant', 'market', 'shopping',
      'smoking', 'smoke', 'alcohol', 'party', 'event'
    ]
  }
];

/**
 * Classifies a message string into one of the 6 query types.
 * Matching is case-insensitive. Falls back to 'general_enquiry'
 * if no keywords match.
 *
 * @param {string} messageText - The raw guest message
 * @returns {string} - One of the 6 query type strings
 */
function classifyMessage(messageText) {
  if (!messageText || typeof messageText !== 'string') {
    return 'general_enquiry';
  }

  const lowerText = messageText.toLowerCase();

  for (const rule of CLASSIFICATION_RULES) {
    const matched = rule.keywords.some((keyword) => lowerText.includes(keyword));
    if (matched) {
      return rule.query_type;
    }
  }

  // Default fallback
  return 'general_enquiry';
}

module.exports = { classifyMessage };
