import mongoose from 'mongoose';
import { CollegeModel, ICollegeDocument } from '../models/college.model.js';

export const INITIAL_COLLEGES = [
  {
    name: 'Indian Institute of Technology Bombay',
    shortName: 'IIT Bombay',
    slug: 'iit-bombay',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    verified: true,
  },
  {
    name: 'Indian Institute of Technology Delhi',
    shortName: 'IIT Delhi',
    slug: 'iit-delhi',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    verified: true,
  },
  {
    name: 'Indian Institute of Technology Madras',
    shortName: 'IIT Madras',
    slug: 'iit-madras',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    verified: true,
  },
  {
    name: 'Indian Institute of Technology Kanpur',
    shortName: 'IIT Kanpur',
    slug: 'iit-kanpur',
    city: 'Kanpur',
    state: 'Uttar Pradesh',
    country: 'India',
    verified: true,
  },
  {
    name: 'Indian Institute of Technology Kharagpur',
    shortName: 'IIT Kharagpur',
    slug: 'iit-kharagpur',
    city: 'Kharagpur',
    state: 'West Bengal',
    country: 'India',
    verified: true,
  },
  {
    name: 'Birla Institute of Technology and Science, Pilani',
    shortName: 'BITS Pilani',
    slug: 'bits-pilani',
    city: 'Pilani',
    state: 'Rajasthan',
    country: 'India',
    verified: true,
  },
  {
    name: 'International Institute of Information Technology, Hyderabad',
    shortName: 'IIIT Hyderabad',
    slug: 'iiit-hyderabad',
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    verified: true,
  },
  {
    name: 'National Institute of Technology, Tiruchirappalli',
    shortName: 'NIT Trichy',
    slug: 'nit-trichy',
    city: 'Tiruchirappalli',
    state: 'Tamil Nadu',
    country: 'India',
    verified: true,
  },
  {
    name: 'Stanford University',
    shortName: 'Stanford',
    slug: 'stanford-university',
    city: 'Stanford',
    state: 'California',
    country: 'United States',
    verified: true,
  },
  {
    name: 'Massachusetts Institute of Technology',
    shortName: 'MIT',
    slug: 'mit',
    city: 'Cambridge',
    state: 'Massachusetts',
    country: 'United States',
    verified: true,
  },
  {
    name: 'University of Oxford',
    shortName: 'Oxford',
    slug: 'oxford',
    city: 'Oxford',
    state: 'Oxfordshire',
    country: 'United Kingdom',
    verified: true,
  },
];

export class CollegeRepository {
  /**
   * Search colleges with prefix and keyword matching
   */
  static async searchColleges(query?: string, limit: number = 20): Promise<ICollegeDocument[]> {
    const safeLimit = Math.min(50, Math.max(1, limit));

    // Seed default directory if empty
    await this.seedDefaultColleges();

    if (!query || query.trim().length === 0) {
      return CollegeModel.find().sort({ name: 1 }).limit(safeLimit);
    }

    const trimmed = query.trim();
    const regex = new RegExp(trimmed, 'i');

    return CollegeModel.find({
      $or: [
        { name: regex },
        { shortName: regex },
        { slug: regex },
        { city: regex },
        { state: regex },
      ],
    })
      .sort({ name: 1 })
      .limit(safeLimit);
  }

  /**
   * Find college by ID
   */
  static async findById(id: string): Promise<ICollegeDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return CollegeModel.findById(id);
  }

  /**
   * Find college by unique slug
   */
  static async findBySlug(slug: string): Promise<ICollegeDocument | null> {
    return CollegeModel.findOne({ slug: slug.toLowerCase().trim() });
  }

  /**
   * Seed controlled college directory if empty
   */
  static async seedDefaultColleges(): Promise<void> {
    const count = await CollegeModel.estimatedDocumentCount();
    if (count === 0) {
      for (const college of INITIAL_COLLEGES) {
        await CollegeModel.updateOne(
          { slug: college.slug },
          { $setOnInsert: college },
          { upsert: true }
        );
      }
    }
  }
}
