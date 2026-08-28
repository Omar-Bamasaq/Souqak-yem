import Ad from "../models/Ad.js";
import mongoose from "mongoose";

/**
 * Arabic spelling dictionary for common words and corrections
 * This can be extended or loaded from an external database
 */
const ARABIC_SPELLING_CORRECTIONS = {
  // Electronics
  "لابتب": "لابتوب",
  "لابتوب": "لابتوب",
  "لابتباب": "لابتوب",
  "لاب": "لابتوب",
  "لابتوبات": "لابتوب",
  "كمبيوتر محمول": "لابتوب",
  "هاتف": "هاتف",
  "تلفون": "هاتف",
  "تلفونات": "هاتف",
  "موبايل": "هاتف",
  "جوال": "هاتف",
  "هاتف سامسنغ": "هاتف سامسونج",
  "سامسنغ": "سامسونج",
  "سامسونق": "سامسونج",
  "ايفون": "iPhone",
  "اي فون": "iPhone",
  "هواوي": "هواوي",
  "هواوى": "هواوي",
  "شاومي": "شاومي",
  "شاومى": "شاومي",
  "ريلمي": "Realme",
  "ريلمى": "Realme",
  "نوكيا": "نوكيا",
  "سوني": "سوني",
  
  // Vehicles
  "سياره": "سيارة",
  "سيارات": "سيارة",
  "تويوت": "تويوتا",
  "تويوته": "تويوتا",
  "هونداي": "هيونداي",
  "هوندايى": "هيونداي",
  "هوندي": "هيونداي",
  "مرسيدس": "مرسيدس",
  "مرسيديس": "مرسيدس",
  "مرسيدس بنز": "مرسيدس",
  "bmw": "بي ام دبليو",
  "بي ام": "بي ام دبليو",
  "كيا": "كيا",
  "نيسان": "نيسان",
  "نيسان": "نيسان",
  
  // Real Estate
  "بيت": "منزل",
  "بيت للبيع": "منزل للبيع",
  "شقه": "شقة",
  "شقق": "شقة",
  "ارض": "أرض",
  "اراضي": "أرض",
  "فيلا": "فيلا",
  "فيله": "فيلا",
  "عمارة": "عمارة",
  "محل": "محل تجاري",
  
  // Furniture
  "اثاث": "أثاث",
  "اثاث منزلي": "أثاث",
  "كنبه": "كنبة",
  "كنب": "كنبة",
  "سرير": "سرير",
  "سرير نوم": "سرير",
  "طاوله": "طاولة",
  "طاولات": "طاولة",
  "ثلاجه": "ثلاجة",
  "ثلاجة": "ثلاجة",
  "غساله": "غسالة",
  "غسالة": "غسالة",
  "مكيف": "مكيف",
  "مكيفات": "مكيف",
  
  // Jobs
  "وظيفه": "وظيفة",
  "وظائف": "وظيفة",
  "موظف": "موظف",
  "موظفين": "موظف",
  "عمل": "عمل",
  "شغل": "عمل",
  
  // General
  "جديد": "جديد",
  "جديده": "جديد",
  "مستعمل": "مستعمل",
  "مستعمله": "مستعمل",
  "نضيف": "نظيف",
  "نضيفه": "نظيف",
  "رخيص": "رخيص",
  "رخيصه": "رخيص",
  "غالي": "غالي",
  "غاليه": "غالي",
};

/**
 * Common Arabic synonyms mapping
 */
const ARABIC_SYNONYMS = {
  "سيارة": ["مركبة", "موتر", "عربية", "سياره"],
  "هاتف": ["تلفون", "موبايل", "جوال", "تليفون"],
  "لابتوب": ["كمبيوتر محمول", "لابتب", "نوت بوك", "Notebook"],
  "منزل": ["بيت", "دار", "منزل", "فيلا", "عمارة"],
  "شقة": ["شقه", "شقق", "apartment"],
  "أرض": ["ارض", "اراضي", "قطعة أرض"],
  "موظف": ["عامل", "موظفين", "موظفة", "شغيل"],
  "عمل": ["وظيفة", "شغل", "وظائف", "توظيف"],
};

/**
 * Cache for search results
 */
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const SearchHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  query: String,
  clickedAdId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad" },
  timestamp: { type: Date, default: Date.now }
});

const SearchHistory = mongoose.models.SearchHistory || mongoose.model("SearchHistory", SearchHistorySchema);

class SmartSearchService {
  /**
   * Calculate Levenshtein distance between two strings
   * Used for fuzzy string matching
   */
  static levenshteinDistance(str1, str2) {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculate similarity score between two strings (0-1)
   */
  static similarityScore(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1;
    
    const distance = this.levenshteinDistance(s1, s2);
    return 1 - distance / maxLen;
  }

  /**
   * Check for spelling mistakes and suggest corrections
   * Returns the corrected query if found, or null if no correction needed
   */
  static getSpellingSuggestion(query) {
    if (!query || query.trim().length < 2) return null;
    
    const normalizedQuery = query.trim().toLowerCase();
    
    // Check if query is already correct (exists in dictionary)
    if (ARABIC_SPELLING_CORRECTIONS[normalizedQuery] === normalizedQuery) {
      return null;
    }
    
    // Direct match in corrections dictionary
    if (ARABIC_SPELLING_CORRECTIONS[normalizedQuery]) {
      return ARABIC_SPELLING_CORRECTIONS[normalizedQuery];
    }

    // Check each word in multi-word query
    const words = normalizedQuery.split(/\s+/);
    const suggestions = [];
    let hasCorrection = false;

    for (const word of words) {
      let corrected = word;
      
      // Check direct correction
      if (ARABIC_SPELLING_CORRECTIONS[word]) {
        corrected = ARABIC_SPELLING_CORRECTIONS[word];
        hasCorrection = true;
      } else {
        // Find closest match using similarity
        let bestMatch = null;
        let bestScore = 0.7; // Minimum threshold

        for (const [incorrect, correct] of Object.entries(ARABIC_SPELLING_CORRECTIONS)) {
          const score = this.similarityScore(word, incorrect);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = correct;
          }
        }

        if (bestMatch) {
          corrected = bestMatch;
          hasCorrection = true;
        }
      }
      
      suggestions.push(corrected);
    }

    return hasCorrection ? suggestions.join(" ") : null;
  }

  /**
   * Expand query with synonyms
   */
  static expandQueryWithSynonyms(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const expandedTerms = [normalizedQuery];

    for (const [mainTerm, synonyms] of Object.entries(ARABIC_SYNONYMS)) {
      // Check if query contains this term
      if (normalizedQuery.includes(mainTerm)) {
        expandedTerms.push(...synonyms);
      }
      
      // Check if any synonym is in the query
      for (const synonym of synonyms) {
        if (normalizedQuery.includes(synonym)) {
          expandedTerms.push(mainTerm, ...synonyms.filter(s => s !== synonym));
        }
      }
    }

    return [...new Set(expandedTerms)]; // Remove duplicates
  }

  static escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Create text search filter with multiple search strategies
   */
  static createTextSearchFilter(queries) {
    const queryList = Array.isArray(queries) ? queries : [queries];
    const cleanedQueries = queryList.map((q) => String(q || "").trim()).filter(Boolean);

    if (cleanedQueries.length === 0) {
      return {};
    }

    // Create multiple search patterns
    const orConditions = [];

    for (const normalizedQuery of cleanedQueries) {
      const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);
      const escapedQuery = this.escapeRegex(normalizedQuery);

      // 1. Exact/phrase match
      orConditions.push({ title: { $regex: escapedQuery, $options: "i" } });
      orConditions.push({ description: { $regex: escapedQuery, $options: "i" } });

      // 2. Word boundary matches
      for (const word of words) {
        if (word.length > 2) {
          const escapedWord = this.escapeRegex(word);
          orConditions.push({ title: { $regex: `\\b${escapedWord}\\b`, $options: "i" } });
          orConditions.push({ description: { $regex: `\\b${escapedWord}\\b`, $options: "i" } });
        }
      }

      // 3. Contains any word
      for (const word of words) {
        if (word.length > 1) {
          const escapedWord = this.escapeRegex(word);
          orConditions.push({ title: { $regex: escapedWord, $options: "i" } });
          orConditions.push({ description: { $regex: escapedWord, $options: "i" } });
        }
      }

      // 4. Tag names match
      for (const word of words) {
        if (word.length > 1) {
          const escapedWord = this.escapeRegex(word);
          orConditions.push({ tagNames: { $elemMatch: { $regex: escapedWord, $options: "i" } } });
        }
      }
    }

    return { $or: orConditions };
  }

  /**
   * Calculate search result relevance score
   */
  static calculateRelevanceScore(ad, query, userLocation = null, userId = null) {
    let score = 0;
    const normalizedQuery = query.toLowerCase().trim();
    const queryWords = normalizedQuery.split(/\s+/);
    
    const title = (ad.title || "").toLowerCase();
    const description = (ad.description || "").toLowerCase();
    const tags = (ad.tags || []).map(t => t.toLowerCase());

    // Title exact match (highest weight)
    if (title === normalizedQuery) {
      score += 100;
    } else if (title.includes(normalizedQuery)) {
      score += 50;
    }

    // Title word matches
    for (const word of queryWords) {
      if (title.includes(word)) {
        score += 20;
        // Bonus for word at beginning
        if (title.startsWith(word)) {
          score += 10;
        }
      }
    }

    // Description matches
    for (const word of queryWords) {
      if (description.includes(word)) {
        score += 10;
      }
    }

    // Tag matches
    for (const word of queryWords) {
      if (tags.some(tag => tag.includes(word))) {
        score += 15;
      }
    }

    // Boost featured ads
    if (ad.featured) {
      score += 25;
    }

    // Boost verified seller
    if (ad.userId?.isVerifiedSeller) {
      score += 15;
    }

    // Recency boost (newer ads get higher score)
    const ageInDays = (Date.now() - new Date(ad.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays < 1) {
      score += 20;
    } else if (ageInDays < 7) {
      score += 15;
    } else if (ageInDays < 30) {
      score += 10;
    }

    // Geographic proximity boost
    if (userLocation && ad.location?.coordinates) {
      const distance = this.calculateDistance(
        userLocation.lat,
        userLocation.lng,
        ad.location.coordinates[1],
        ad.location.coordinates[0]
      );
      
      if (distance < 5) {
        score += 30; // Within 5km
      } else if (distance < 20) {
        score += 20; // Within 20km
      } else if (distance < 50) {
        score += 10; // Within 50km
      }
    }

    // Boost if matches user's previous interactions (if userId provided)
    if (userId && ad.userInteractions) {
      const userInteraction = ad.userInteractions.find(
        ui => ui.userId.toString() === userId.toString()
      );
      if (userInteraction) {
        score += userInteraction.score * 10;
      }
    }

    return score;
  }

  /**
   * Calculate distance between two coordinates in km
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Get cache key for search query
   */
  static getCacheKey(params) {
    return JSON.stringify(params);
  }

  /**
   * Get cached result or null
   */
  static getCachedResult(cacheKey) {
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    searchCache.delete(cacheKey);
    return null;
  }

  /**
   * Set cache result
   */
  static setCachedResult(cacheKey, data) {
    searchCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    // Clean old entries if cache is too large
    if (searchCache.size > 100) {
      const oldestKey = searchCache.keys().next().value;
      searchCache.delete(oldestKey);
    }
  }

  /**
   * Enhanced Arabic Normalization
   * Normalizes letters that often vary (alef, teh marbuta, yah)
   */
  static normalizeArabic(text) {
    if (!text) return "";
    return text
      .replace(/[أإآا]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/[ىي]/g, "ي")
      .replace(/[ًٌٍَُِّ]/g, "") // Remove harakat (tashkeel)
      .trim();
  }

  /**
   * Extract potential filters from query string
   */
  static extractFiltersFromQuery(query) {
    const normalized = this.normalizeArabic(query.toLowerCase());
    const filters = {};

    // 1. Condition extraction
    if (normalized.includes("جديد")) filters.condition = "new";
    if (normalized.includes("مستعمل") || normalized.includes("نضيف")) filters.condition = "used";

    // 2. Ad Type extraction
    if (normalized.includes("مطلوب") || normalized.includes("شراء")) filters.adType = "order";
    if (normalized.includes("بيع") || normalized.includes("للبيع")) filters.adType = "sell";

    // 3. Price related
    if (normalized.includes("رخيص") || normalized.includes("اقل سعر")) filters.sort = "price_asc";
    if (normalized.includes("غالي") || normalized.includes("افضل نوع")) filters.sort = "best";

    return filters;
  }

  /**
   * Predict likely categories based on query keywords
   */
  static async predictCategories(query) {
    if (!query) return [];
    const normalized = this.normalizeArabic(query);
    const keywords = normalized.split(/\s+/).filter(k => k.length > 2);
    
    if (keywords.length === 0) return [];

    try {
      const Category = (await import("../models/Category.js")).default;
      // Search for categories matching keywords in their names or slugs
      const matched = await Category.find({
        $or: keywords.map(k => ({
          name: { $regex: this.escapeRegex(k), $options: "i" }
        }))
      }).select("_id parentId").lean();

      return matched.map(c => c._id);
    } catch (err) {
      console.error("Category prediction error:", err);
      return [];
    }
  }

  /**
   * Main smart search function
   */
  static async search({
    query,
    categoryId = null,
    subCategoryId = null,
    governorateId = null,
    cityId = null,
    minPrice = null,
    maxPrice = null,
    conditions = null,
    verifiedOnly = false,
    featuredOnly = false,
    userLat = null,
    userLng = null,
    userId = null,
    adType = null,
    page = 1,
    limit = 20,
    sort = "best"
  }) {
    const startTime = Date.now();

    const originalQuery = String(query || "").trim();

    // 1. Auto-extract filters from query if not manually set
    const autoFilters = originalQuery ? this.extractFiltersFromQuery(originalQuery) : {};
    
    // Use manual values if provided, otherwise use auto-detected ones
    const finalCondition = conditions || autoFilters.condition;
    const finalAdType = adType || autoFilters.adType;
    const finalSort = sort === "relevance" && autoFilters.sort ? autoFilters.sort : sort;

    // 2. Spelling & Synonyms
    const spellingSuggestion = this.getSpellingSuggestion(originalQuery);
    const expandedQueries = originalQuery
      ? this.expandQueryWithSynonyms(originalQuery)
      : [];

    // 3. Category Prediction (for boosting results in relevant categories)
    const predictedCategoryIds = originalQuery ? await this.predictCategories(originalQuery) : [];

    // Check cache
    const cacheParams = {
      originalQuery, categoryId, subCategoryId, governorateId, cityId,
      minPrice, maxPrice, conditions: finalCondition, page, limit, sort: finalSort,
      verifiedOnly, featuredOnly, userLat, userLng, userId, adType: finalAdType
    };
    const cacheKey = this.getCacheKey(cacheParams);
    const cachedResult = this.getCachedResult(cacheKey);
    
    if (cachedResult) {
      return {
        ...cachedResult,
        fromCache: true,
        spellingSuggestion,
        originalQuery,
        searchTime: Date.now() - startTime
      };
    }

    // Build base filter
    const filter = {
      status: "approved",
      expiresAt: { $gt: new Date() },
      isArchived: { $ne: true },
      sold: { $ne: true },
      isDeleted: { $ne: true }
    };

    // Find categories that match the query
    let searchCategoryIds = [];
    if (originalQuery) {
      const Category = (await import("../models/Category.js")).default;
      const matchedCategories = await Category.find({
        name: { $regex: this.escapeRegex(originalQuery), $options: "i" }
      }).select("_id parentId slug").lean();

      if (matchedCategories.length > 0) {
        // If query matched 'Purchase Orders' category, force adType to 'order'
        if (matchedCategories.some(c => c.slug === "purchase-orders")) {
          adType = "order";
        }

        searchCategoryIds = matchedCategories
          .filter(c => c.slug !== "purchase-orders") // Exclude 'Purchase Orders' from ID filter
          .map(c => c._id);

        // Also include subcategories of matched parent categories
        if (searchCategoryIds.length > 0) {
          const subCategories = await Category.find({
            parentId: { $in: searchCategoryIds }
          }).select("_id").lean();
          searchCategoryIds.push(...subCategories.map(c => c._id));
        }
      }
    }

    // Add category filters
    if (subCategoryId) {
      filter.categoryId = new mongoose.Types.ObjectId(subCategoryId);
    } else if (categoryId) {
      // Include subcategories recursively
      const Category = (await import("../models/Category.js")).default;
      const category = await Category.findById(categoryId).lean();
      
      if (category && category.slug === "purchase-orders") {
        // If user specifically chose 'Purchase Orders' category root, 
        // we treat it as filtering for all order types
        adType = "order";
        // Do not add categoryId filter for the root 'Purchase Orders'
      } else if (category) {
        // Recursive function to get all descendant IDs
        const getAllDescendants = async (parentIds) => {
          const children = await Category.find({ parentId: { $in: parentIds } }).select("_id").lean();
          if (children.length === 0) return [];
          const childIds = children.map(c => c._id);
          const descendants = await getAllDescendants(childIds);
          return [...childIds, ...descendants];
        };

        const descendantIds = await getAllDescendants([categoryId]);
        const allCategoryIds = [
          String(categoryId),
          ...descendantIds.map(id => String(id))
        ];
        filter.categoryId = {
          $in: allCategoryIds.map(id => new mongoose.Types.ObjectId(id))
        };
      } else {
        filter.categoryId = new mongoose.Types.ObjectId(categoryId);
      }
    }

    // Add text search OR matched categories
    if (expandedQueries.length > 0) {
      const textFilter = this.createTextSearchFilter(expandedQueries);
      
      if (searchCategoryIds.length > 0) {
        // Create an $or that combines text search AND category matches
        filter.$or = [
          ...(textFilter.$or || []),
          { categoryId: { $in: searchCategoryIds } }
        ];
      } else {
        Object.assign(filter, textFilter);
      }
    } else if (searchCategoryIds.length > 0) {
      filter.categoryId = { $in: searchCategoryIds };
    }

    // Add location filters
    if (cityId) {
      filter.cityId = new mongoose.Types.ObjectId(cityId);
    } else if (governorateId) {
      filter.governorateId = new mongoose.Types.ObjectId(governorateId);
    }

    // Add price filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Add condition filter
    if (conditions) {
      const condValues = String(conditions).split(",").map(s => s.trim()).filter(Boolean);
      if (condValues.length) {
        filter.condition = { $in: condValues };
      }
    }

    // Apply featured-only filter at DB level when possible
    if (featuredOnly === true || featuredOnly === "true") {
      filter.featured = true;
    }

    if (adType) {
      filter.adType = adType;
    }

    // Execute search
    let ads = await Ad.find(filter)
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .populate({
        path: "categoryId",
        select: "name slug parentId",
        populate: {
          path: "parentId",
          select: "name"
        }
      })
      .populate("userId", "isVerifiedSeller isTrustedReseller name avatar sellerRating sellerReviewsCount")
      .lean();

    // Filter by conditions
    if (finalCondition) {
      const condValues = String(finalCondition).split(",").map(s => s.trim()).filter(Boolean);
      if (condValues.length) {
        ads = ads.filter(ad => condValues.includes(ad.condition));
      }
    }

    // Calculate relevance score for relevance-based features
    const userLocation = userLat && userLng ? { lat: userLat, lng: userLng } : null;
    const queryForScore = originalQuery || spellingSuggestion || "";
    ads = ads.map(ad => ({
      ...ad,
      relevanceScore: this.calculateRelevanceScore(ad, queryForScore, userLocation, userId)
    }));

    // Boost predicted categories
    if (predictedCategoryIds.length > 0) {
      ads = ads.map(ad => {
        if (predictedCategoryIds.some(id => String(id) === String(ad.categoryId?._id || ad.categoryId))) {
          return { ...ad, relevanceScore: (ad.relevanceScore || 0) + 30 };
        }
        return ad;
      });
    }

    // Personalization Boost (based on search history)
    if (userId) {
      try {
        const recentQueries = await SearchHistory.find({ userId }).sort({ timestamp: -1 }).limit(10).select("query").lean();
        if (recentQueries.length > 0) {
          ads = ads.map(ad => {
            let pBoost = 0;
            const adTitle = this.normalizeArabic(ad.title);
            for (const h of recentQueries) {
              if (adTitle.includes(this.normalizeArabic(h.query))) {
                pBoost += 10;
              }
            }
            return { ...ad, relevanceScore: (ad.relevanceScore || 0) + pBoost };
          });
        }
      } catch (hErr) {
        console.error("Personalization boost error:", hErr);
      }
    }

    // Optional post-filter for verified sellers
    if (verifiedOnly === true || verifiedOnly === "true") {
      ads = ads.filter(a => a?.userId?.isVerifiedSeller === true);
    }

    // Optional confirm featured flag
    if (featuredOnly === true || featuredOnly === "true") {
      ads = ads.filter(a => a?.featured === true);
    }

    ads = this.sortAds(ads, finalSort);

    // Apply pagination
    const total = ads.length;
    const startIndex = (page - 1) * limit;
    const paginatedAds = ads.slice(startIndex, startIndex + limit);

    const result = {
      items: paginatedAds,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      spellingSuggestion,
      originalQuery,
      autoFilters,
      correctedQuery: spellingSuggestion || originalQuery,
      searchTime: Date.now() - startTime
    };

    // Cache the result
    this.setCachedResult(cacheKey, result);

    return result;
  }

  static sortAds(ads, sort) {
    const s = String(sort || "best").toLowerCase();
    const copy = [...ads];
    
    // Default sorting priority: Featured first, then by criteria
    if (s === "price_asc" || s === "pricelow") {
      copy.sort((a, b) => {
        if (a.featured !== b.featured) return b.featured ? 1 : -1;
        return (Number(a.price || 0) - Number(b.price || 0)) || (new Date(b.createdAt) - new Date(a.createdAt));
      });
    } else if (s === "price_desc" || s === "pricehigh") {
      copy.sort((a, b) => {
        if (a.featured !== b.featured) return b.featured ? 1 : -1;
        return (Number(b.price || 0) - Number(a.price || 0)) || (new Date(b.createdAt) - new Date(a.createdAt));
      });
    } else if (s === "old") {
      copy.sort((a, b) => {
        if (a.featured !== b.featured) return b.featured ? 1 : -1;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
    } else if (s === "new") {
      copy.sort((a, b) => {
        if (a.featured !== b.featured) return b.featured ? 1 : -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    } else if (s === "views") {
      copy.sort((a, b) => {
        if (a.featured !== b.featured) return b.featured ? 1 : -1;
        return (Number(b.viewCount || 0) - Number(a.viewCount || 0)) || (new Date(b.createdAt) - new Date(a.createdAt));
      });
    } else {
      copy.sort((a, b) => {
        if (a.featured !== b.featured) return b.featured ? 1 : -1;
        return (Number(b.relevanceScore || 0) - Number(a.relevanceScore || 0)) || (new Date(b.createdAt) - new Date(a.createdAt));
      });
    }
    return copy;
  }

  static filterByFlags(ads, { featuredOnly = false, verifiedOnly = false } = {}) {
    let out = [...ads];
    if (featuredOnly === true || featuredOnly === "true") {
      out = out.filter(a => a?.featured === true);
    }
    if (verifiedOnly === true || verifiedOnly === "true") {
      out = out.filter(a => a?.userId?.isVerifiedSeller === true);
    }
    return out;
  }

  /**
   * Get search suggestions as user types
   */
  static async getSuggestions(partialQuery, limit = 5) {
    if (!partialQuery || partialQuery.length < 2) {
      return { titles: [], corrections: [], synonyms: [] };
    }

    const normalizedQuery = partialQuery.toLowerCase().trim();
    
    // Get matching ads titles
    const suggestions = await Ad.find({
      status: "approved",
      expiresAt: { $gt: new Date() },
      title: { $regex: normalizedQuery, $options: "i" }
    })
      .select("title")
      .limit(limit * 2)
      .lean();

    // Extract unique suggestions
    const uniqueTitles = [...new Set(suggestions.map(s => s.title))];
    
    // Get popular search terms from corrections dictionary
    const matchingTerms = Object.keys(ARABIC_SPELLING_CORRECTIONS)
      .filter(term => term.includes(normalizedQuery))
      .slice(0, limit);

    return {
      titles: uniqueTitles.slice(0, limit),
      corrections: matchingTerms,
      synonyms: this.getRelatedSynonyms(normalizedQuery)
    };
  }

  /**
   * Get related synonyms for a query
   */
  static getRelatedSynonyms(query) {
    const related = [];
    
    for (const [mainTerm, synonyms] of Object.entries(ARABIC_SYNONYMS)) {
      if (query.includes(mainTerm) || synonyms.some(s => query.includes(s))) {
        related.push(mainTerm, ...synonyms);
      }
    }
    
    return [...new Set(related)];
  }

  /**
   * Track user search for personalization
   */
  static async trackSearch(userId, query, clickedAdId = null) {
    // This can be used to build user profiles for better recommendations
    // Store in a separate collection for analytics
    try {
      await SearchHistory.create({
        userId: userId || null,
        query,
        clickedAdId: clickedAdId || null
      });
    } catch (error) {
      console.error("Error tracking search:", error);
    }
  }
}

export default SmartSearchService;
