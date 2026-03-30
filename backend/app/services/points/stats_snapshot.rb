module Points
  class StatsSnapshot
    TRUE_VALUES = %w[1 true yes on].freeze
    FALSE_VALUES = %w[0 false no off].freeze
    VALID_SCOPES = %w[both viewport totals].freeze

    def initialize(year:, pc4: nil, include_private: nil, include_isorg: nil, bbox:, scope: nil)
      @year = Integer(year)
      @pc4 = normalize_pc4(pc4)
      @include_private = parse_boolean(include_private, default: true)
      @include_isorg = parse_boolean(include_isorg, default: true)
      @scope = normalize_scope(scope)
      @bbox = parse_bbox(bbox)
      validate!
    end

    def as_json(*)
      {
        year: year,
        filters: {
          pc4: pc4,
          include_private: include_private,
          include_isorg: include_isorg,
          scope: scope,
          bbox: serialized_bbox,
        },
        viewport: include_viewport? ? summarize(viewport_entries) : nil,
        filtered_total: include_totals? ? summarize(filtered_entries) : nil,
      }
    end

    private

    attr_reader :bbox, :include_isorg, :include_private, :pc4, :scope, :year

    def filtered_entries
      @filtered_entries ||= begin
        scoped = Entry.for_year(year)
        scoped = scoped.where(pc4: pc4) if pc4.present?
        apply_mode_filter(scoped)
      end
    end

    def viewport_entries
      @viewport_entries ||= filtered_entries.where(
        lat: bbox[:south]..bbox[:north],
        lng: bbox[:west]..bbox[:east],
      )
    end

    def summarize(entries)
      {
        entry_count: entries.count,
        private_entries_count: entries.where(is_org: false).count,
        isorg_entries_count: entries.where(is_org: true).count,
        bird_sum_count: EntryBirdCount.joins(:entry).merge(entries).sum(:count),
      }
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

    def normalize_scope(value)
      normalized = value.to_s.strip
      return "both" if normalized.empty?
      return normalized if VALID_SCOPES.include?(normalized)

      raise ArgumentError, "invalid scope"
    end

    def validate!
      raise ArgumentError, "year must be positive" unless year.positive?
      raise ArgumentError, "at least one mode must be included" unless include_private || include_isorg
      raise ArgumentError, "bbox required for viewport scope" if include_viewport? && bbox.nil?
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

    def serialized_bbox
      return nil unless include_viewport? && bbox

      [bbox[:west], bbox[:south], bbox[:east], bbox[:north]]
    end

    def include_viewport?
      scope == "both" || scope == "viewport"
    end

    def include_totals?
      scope == "both" || scope == "totals"
    end
  end
end
