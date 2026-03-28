module Species
  class EntryScope
    VALID_SCOPES = %w[all viewport].freeze
    TRUE_VALUES = %w[1 true yes on].freeze
    FALSE_VALUES = %w[0 false no off].freeze

    attr_reader :bbox, :include_isorg, :include_private, :pc4, :scope, :year

    def initialize(area_slug:, year:, pc4: nil, include_private: nil, include_isorg: nil, scope: nil, bbox: nil)
      @area = Areas::Catalog.fetch!(area_slug)
      @year = Integer(year)
      @pc4 = normalize_pc4(pc4)
      @include_private = parse_boolean(include_private, default: true)
      @include_isorg = parse_boolean(include_isorg, default: true)
      @scope = normalize_scope(scope)
      @bbox = parse_bbox(bbox)
      validate!
    end

    def relation
      scoped = Entry.for_year(year).where(pc4: allowed_pc4_codes)
      scoped = scoped.where(pc4: pc4) if pc4.present?
      scoped = apply_mode_filter(scoped)
      scoped = apply_bbox(scoped) if scope == "viewport"
      scoped
    end

    private

    attr_reader :area

    def allowed_pc4_codes
      @allowed_pc4_codes ||= area.pc4_codes
    end

    def normalize_pc4(value)
      str = value.to_s.strip
      return nil if str.empty?
      raise ArgumentError, "invalid pc4" unless str.match?(/\A\d{4}\z/)

      str
    end

    def parse_boolean(value, default:)
      return default if value.nil?

      normalized = value.to_s.strip.downcase
      return true if TRUE_VALUES.include?(normalized)
      return false if FALSE_VALUES.include?(normalized)

      raise ArgumentError, "invalid boolean"
    end

    def normalize_scope(value)
      normalized = value.to_s.strip
      return "all" if normalized.empty?
      return normalized if VALID_SCOPES.include?(normalized)

      raise ArgumentError, "invalid scope"
    end

    def parse_bbox(value)
      return nil if value.nil?
      return nil if value.respond_to?(:empty?) && value.empty?

      parts = value.is_a?(Array) ? value : value.to_s.split(",")
      raise ArgumentError, "invalid bbox" unless parts.size == 4

      west, south, east, north = parts.map { |part| Float(part) }
      raise ArgumentError, "invalid bbox" unless west < east && south < north

      { west:, south:, east:, north: }
    rescue ArgumentError, TypeError
      raise ArgumentError, "invalid bbox"
    end

    def validate!
      raise ArgumentError, "year must be positive" unless year.positive?
      raise ArgumentError, "at least one mode must be included" unless include_private || include_isorg
      raise ArgumentError, "bbox required for viewport scope" if scope == "viewport" && bbox.nil?
      raise ArgumentError, "pc4 outside area" if pc4.present? && !allowed_pc4_codes.include?(pc4)
    end

    def apply_mode_filter(scoped)
      if include_private && include_isorg
        scoped
      elsif include_private
        scoped.where(is_org: false)
      else
        scoped.where(is_org: true)
      end
    end

    def apply_bbox(scoped)
      scoped.where(lat: bbox[:south]..bbox[:north], lng: bbox[:west]..bbox[:east])
    end
  end
end
