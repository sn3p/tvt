module Navigation
  class Pc4BoundsSnapshot
    MIN_LAT_PAD = 0.004
    MIN_LNG_PAD = 0.006
    PAD_FACTOR = 0.15

    def initialize(year:, pc4:)
      @year = Integer(year)
      @pc4 = normalize_pc4(pc4)
      validate!
    end

    def as_json(*)
      {
        year: year,
        pc4: pc4,
        entry_count: entries.count,
        bbox: serialized_bbox,
      }
    end

    private

    attr_reader :pc4, :year

    def entries
      @entries ||= begin
        scoped = Entry.for_year(year).where(pc4: pc4)
        raise ActiveRecord::RecordNotFound, "pc4 not found" unless scoped.exists?

        scoped
      end
    end

    def serialized_bbox
      @serialized_bbox ||= begin
        south = entries.minimum(:lat).to_f
        north = entries.maximum(:lat).to_f
        west = entries.minimum(:lng).to_f
        east = entries.maximum(:lng).to_f

        lat_pad = [(north - south) * PAD_FACTOR, MIN_LAT_PAD].max
        lng_pad = [(east - west) * PAD_FACTOR, MIN_LNG_PAD].max

        [west - lng_pad, south - lat_pad, east + lng_pad, north + lat_pad]
      end
    end

    def normalize_pc4(value)
      str = value.to_s.strip
      raise ArgumentError, "invalid pc4" unless str.match?(/\A\d{4}\z/)

      str
    end

    def validate!
      raise ArgumentError, "year must be positive" unless year.positive?
    end
  end
end
