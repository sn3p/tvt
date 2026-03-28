module Areas
  class Catalog
    AreaDefinition = Data.define(:slug, :name, :type, :code, :generated_at_utc, :pc4_codes)

    def self.fetch!(slug)
      definition = load(slug)
      raise ActiveRecord::RecordNotFound, "area not found" unless definition

      definition
    end

    def self.load(slug)
      area_slug = slug.to_s.strip.downcase
      return nil if area_slug.blank?

      path = Rails.root.join("config/areas/#{area_slug}.json")
      return nil unless path.exist?

      payload = JSON.parse(path.read)

      AreaDefinition.new(
        slug: area_slug,
        name: payload.fetch("name"),
        type: payload.fetch("type"),
        code: payload.fetch("code"),
        generated_at_utc: payload["generated_at_utc"],
        pc4_codes: Array(payload.fetch("pc4")).map(&:to_s).uniq.sort,
      )
    end
  end
end
