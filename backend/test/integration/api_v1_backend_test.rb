require "test_helper"

class ApiV1BackendTest < ActionDispatch::IntegrationTest
  setup do
    EntryTileMembership.delete_all
    EntryBirdCount.delete_all
    Bird.delete_all
    Entry.delete_all
  end

  test "status reports database connectivity and per-year counts" do
    entry_2025 = Entry.create!(
      year: 2025,
      external_id: 1001,
      pc4: "9721",
      lat: 53.2194,
      lng: 6.5665,
      is_org: false,
    )
    entry_2026 = Entry.create!(
      year: 2026,
      external_id: 1002,
      pc4: "1011",
      lat: 52.3676,
      lng: 4.9041,
      is_org: true,
    )
    bird = Bird.create!(external_id: 9, name: "Ekster")
    EntryBirdCount.create!(entry: entry_2026, bird: bird, rank: 1, count: 3, bird_name_cache: "Ekster")
    EntryTileMembership.create!(entry: entry_2025, year: 2025, mode: "private", z: 6, x: 32, y: 21)
    EntryTileMembership.create!(entry: entry_2026, year: 2026, mode: "isorg", z: 6, x: 32, y: 21)

    get "/api/v1/status"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal true, body.dig("database", "connected")
    assert body["latest_update_utc"].present?

    year_2025 = body.fetch("years").find { |row| row["year"] == 2025 }
    year_2026 = body.fetch("years").find { |row| row["year"] == 2026 }

    assert_equal 1, year_2025["entries_count"]
    assert_equal 1, year_2025["private_entries_count"]
    assert_equal 0, year_2025["isorg_entries_count"]
    assert_equal 0, year_2025["top_bird_rows_count"]
    assert_equal 1, year_2025.dig("tile_memberships", "private")
    assert_equal 0, year_2025.dig("tile_memberships", "isorg")

    assert_equal 1, year_2026["entries_count"]
    assert_equal 0, year_2026["private_entries_count"]
    assert_equal 1, year_2026["isorg_entries_count"]
    assert_equal 1, year_2026["top_bird_rows_count"]
    assert_equal 0, year_2026.dig("tile_memberships", "private")
    assert_equal 1, year_2026.dig("tile_memberships", "isorg")
  end

  test "manifest exposes years and published modes" do
    Entry.create!(
      year: 2025,
      external_id: 1001,
      pc4: "9721",
      lat: 53.2194,
      lng: 6.5665,
      is_org: false,
    )
    Entry.create!(
      year: 2026,
      external_id: 1002,
      pc4: "1011",
      lat: 52.3676,
      lng: 4.9041,
      is_org: true,
    )

    get "/api/v1/point_tiles/manifest"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 1, body["contract_version"]
    assert_equal [2025, 2026], body["years_available"]
    assert_equal %w[private isorg], body["modes_available"]
    assert_equal "private", body.dig("defaults", "mode")
    assert_equal 6, body.dig("defaults", "zoom_min")
    assert_equal 13, body.dig("defaults", "zoom_max")
  end

  test "point tile returns expected points for a populated tile" do
    entry = Entry.create!(
      year: 2025,
      external_id: 463_535,
      pc4: "1011",
      lat: 52.3662666,
      lng: 4.9025050,
      is_org: false,
    )
    EntryTileMembership.create!(
      entry: entry,
      year: 2025,
      mode: "private",
      z: 6,
      x: 32,
      y: 21,
    )

    get "/api/v1/years/2025/point_tiles/private/6/32/21"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 2025, body["year"]
    assert_equal "private", body["mode"]
    assert_equal 6, body["z"]
    assert_equal 32, body["x"]
    assert_equal 21, body["y"]
    assert_equal 1, body["points"].length
    assert_equal 463_535, body["points"][0]["id"]
    assert_equal "1011", body["points"][0]["pc4"]
  end

  test "point tile rejects unsupported modes" do
    get "/api/v1/years/2025/point_tiles/type1/6/32/21"

    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_match(/unsupported mode/, body["error"])
  end

  test "point tile rejects out of range coordinates" do
    get "/api/v1/years/2025/point_tiles/private/15/32/21"

    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_equal "invalid tile parameters", body["error"]
  end

  test "point tile returns an empty points array for a tile with no memberships" do
    get "/api/v1/years/2025/point_tiles/isorg/9/0/0"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal [], body["points"]
  end

  test "point stats returns viewport and filtered totals" do
    private_inside = Entry.create!(
      year: 2026,
      external_id: 1501,
      pc4: "1011",
      lat: 52.3676,
      lng: 4.9041,
      is_org: false,
    )
    isorg_inside = Entry.create!(
      year: 2026,
      external_id: 1502,
      pc4: "1011",
      lat: 52.3680,
      lng: 4.9050,
      is_org: true,
    )
    private_outside_bbox = Entry.create!(
      year: 2026,
      external_id: 1503,
      pc4: "1011",
      lat: 52.3900,
      lng: 4.9400,
      is_org: false,
    )
    other_pc4 = Entry.create!(
      year: 2026,
      external_id: 1504,
      pc4: "9721",
      lat: 53.2194,
      lng: 6.5665,
      is_org: false,
    )

    ekster = Bird.create!(external_id: 9, name: "Ekster")
    merel = Bird.create!(external_id: 50, name: "Merel")

    EntryBirdCount.create!(entry: private_inside, bird: ekster, rank: 1, count: 3, bird_name_cache: "Ekster")
    EntryBirdCount.create!(entry: isorg_inside, bird: merel, rank: 1, count: 5, bird_name_cache: "Merel")
    EntryBirdCount.create!(entry: private_outside_bbox, bird: ekster, rank: 1, count: 7, bird_name_cache: "Ekster")
    EntryBirdCount.create!(entry: other_pc4, bird: ekster, rank: 1, count: 11, bird_name_cache: "Ekster")

    get "/api/v1/years/2026/point_stats", params: {
      pc4: "1011",
      include_private: 1,
      include_isorg: 1,
      bbox: "4.90,52.36,4.91,52.37",
    }

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 2026, body["year"]
    assert_equal "1011", body.dig("filters", "pc4")
    assert_equal true, body.dig("filters", "include_private")
    assert_equal true, body.dig("filters", "include_isorg")
    assert_equal [4.9, 52.36, 4.91, 52.37], body.dig("filters", "bbox")

    assert_equal 2, body.dig("viewport", "entry_count")
    assert_equal 1, body.dig("viewport", "private_entries_count")
    assert_equal 1, body.dig("viewport", "isorg_entries_count")
    assert_equal 8, body.dig("viewport", "bird_sum_count")

    assert_equal 3, body.dig("filtered_total", "entry_count")
    assert_equal 2, body.dig("filtered_total", "private_entries_count")
    assert_equal 1, body.dig("filtered_total", "isorg_entries_count")
    assert_equal 15, body.dig("filtered_total", "bird_sum_count")
  end

  test "point stats rejects invalid parameters" do
    get "/api/v1/years/2026/point_stats", params: { include_private: 0, include_isorg: 0 }

    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_equal "invalid point stats parameters", body["error"]
  end

  test "species manifest returns Groningen summary for a year" do
    private_entry = Entry.create!(
      year: 2026,
      external_id: 2001,
      pc4: "9721",
      lat: 53.2194,
      lng: 6.5665,
      is_org: false,
    )
    isorg_entry = Entry.create!(
      year: 2026,
      external_id: 2002,
      pc4: "9711",
      lat: 53.2180,
      lng: 6.5700,
      is_org: true,
    )
    outside_entry = Entry.create!(
      year: 2026,
      external_id: 2003,
      pc4: "1011",
      lat: 52.3676,
      lng: 4.9041,
      is_org: false,
    )

    bird_a = Bird.create!(external_id: 9, name: "Ekster")
    bird_b = Bird.create!(external_id: 50, name: "Merel")
    bird_c = Bird.create!(external_id: 79, name: "Zwarte kraai")

    EntryBirdCount.create!(entry: private_entry, bird: bird_a, rank: 1, count: 3, bird_name_cache: "Ekster")
    EntryBirdCount.create!(entry: isorg_entry, bird: bird_a, rank: 1, count: 1, bird_name_cache: "Ekster")
    EntryBirdCount.create!(entry: isorg_entry, bird: bird_b, rank: 2, count: 2, bird_name_cache: "Merel")
    EntryBirdCount.create!(entry: outside_entry, bird: bird_c, rank: 1, count: 4, bird_name_cache: "Zwarte kraai")

    get "/api/v1/areas/groningen/species_manifest", params: { year: 2026 }

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal "groningen", body.dig("area", "slug")
    assert_equal "Groningen", body.dig("area", "name")
    assert_equal "GM0014", body.dig("area", "code")
    assert_equal 2026, body["year"]
    assert_equal 50, body["pc4_count"]
    assert_equal 2, body["entry_count"]
    assert_equal 1, body["private_entries_count"]
    assert_equal 1, body["isorg_entries_count"]
    assert_equal 2, body["species_count"]
    assert body["latest_update_utc"].present?
  end

  test "species catalog returns scoped species aggregates" do
    private_inside = Entry.create!(
      year: 2026,
      external_id: 3001,
      pc4: "9721",
      lat: 53.2194,
      lng: 6.5665,
      is_org: false,
    )
    isorg_inside = Entry.create!(
      year: 2026,
      external_id: 3002,
      pc4: "9711",
      lat: 53.2200,
      lng: 6.5680,
      is_org: true,
    )
    private_other_pc4 = Entry.create!(
      year: 2026,
      external_id: 3003,
      pc4: "9731",
      lat: 53.2300,
      lng: 6.5900,
      is_org: false,
    )
    outside_bbox = Entry.create!(
      year: 2026,
      external_id: 3004,
      pc4: "9721",
      lat: 53.2600,
      lng: 6.7000,
      is_org: false,
    )

    ekster = Bird.create!(external_id: 9, name: "Ekster")
    merel = Bird.create!(external_id: 50, name: "Merel")
    kauw = Bird.create!(external_id: 26, name: "Kauw")

    EntryBirdCount.create!(entry: private_inside, bird: ekster, rank: 1, count: 3, bird_name_cache: "Ekster")
    EntryBirdCount.create!(entry: private_inside, bird: merel, rank: 2, count: 1, bird_name_cache: "Merel")
    EntryBirdCount.create!(entry: isorg_inside, bird: ekster, rank: 1, count: 1, bird_name_cache: "Ekster")
    EntryBirdCount.create!(entry: isorg_inside, bird: kauw, rank: 2, count: 5, bird_name_cache: "Kauw")
    EntryBirdCount.create!(entry: private_other_pc4, bird: merel, rank: 1, count: 4, bird_name_cache: "Merel")
    EntryBirdCount.create!(entry: outside_bbox, bird: merel, rank: 1, count: 7, bird_name_cache: "Merel")

    get "/api/v1/areas/groningen/species_catalog", params: {
      year: 2026,
      scope: "viewport",
      bbox: "6.55,53.21,6.58,53.23",
    }

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal "viewport", body["scope"]
    assert_equal [6.55, 53.21, 6.58, 53.23], body.dig("filters", "bbox")
    assert_equal [
      { "bird_id" => 9, "name" => "Ekster", "with_count" => 2, "sum_count" => 4 },
      { "bird_id" => 26, "name" => "Kauw", "with_count" => 1, "sum_count" => 5 },
      { "bird_id" => 50, "name" => "Merel", "with_count" => 1, "sum_count" => 1 },
    ], body["species"]
  end

  test "species catalog applies pc4 and mode filters" do
    private_entry = Entry.create!(
      year: 2026,
      external_id: 3101,
      pc4: "9721",
      lat: 53.2194,
      lng: 6.5665,
      is_org: false,
    )
    isorg_entry = Entry.create!(
      year: 2026,
      external_id: 3102,
      pc4: "9721",
      lat: 53.2200,
      lng: 6.5680,
      is_org: true,
    )
    other_pc4 = Entry.create!(
      year: 2026,
      external_id: 3103,
      pc4: "9711",
      lat: 53.2210,
      lng: 6.5690,
      is_org: true,
    )

    ekster = Bird.create!(external_id: 9, name: "Ekster")
    merel = Bird.create!(external_id: 50, name: "Merel")

    EntryBirdCount.create!(entry: private_entry, bird: ekster, rank: 1, count: 2, bird_name_cache: "Ekster")
    EntryBirdCount.create!(entry: isorg_entry, bird: merel, rank: 1, count: 3, bird_name_cache: "Merel")
    EntryBirdCount.create!(entry: other_pc4, bird: ekster, rank: 1, count: 4, bird_name_cache: "Ekster")

    get "/api/v1/areas/groningen/species_catalog", params: {
      year: 2026,
      pc4: "9721",
      include_private: 0,
      include_isorg: 1,
    }

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal "9721", body.dig("filters", "pc4")
    assert_equal false, body.dig("filters", "include_private")
    assert_equal true, body.dig("filters", "include_isorg")
    assert_equal [
      { "bird_id" => 50, "name" => "Merel", "with_count" => 1, "sum_count" => 3 },
    ], body["species"]
  end

  test "species grid returns aggregated viewport cells" do
    inside_a = Entry.create!(
      year: 2026,
      external_id: 3201,
      pc4: "9721",
      lat: 53.2194,
      lng: 6.5665,
      is_org: false,
    )
    inside_b = Entry.create!(
      year: 2026,
      external_id: 3202,
      pc4: "9711",
      lat: 53.2200,
      lng: 6.5680,
      is_org: true,
    )
    inside_c = Entry.create!(
      year: 2026,
      external_id: 3203,
      pc4: "9721",
      lat: 53.2210,
      lng: 6.5690,
      is_org: false,
    )
    outside_bbox = Entry.create!(
      year: 2026,
      external_id: 3204,
      pc4: "9721",
      lat: 53.3000,
      lng: 6.8000,
      is_org: false,
    )

    ekster = Bird.create!(external_id: 9, name: "Ekster")
    merel = Bird.create!(external_id: 50, name: "Merel")

    EntryBirdCount.create!(entry: inside_a, bird: ekster, rank: 1, count: 3, bird_name_cache: "Ekster")
    EntryBirdCount.create!(entry: inside_b, bird: ekster, rank: 1, count: 1, bird_name_cache: "Ekster")
    EntryBirdCount.create!(entry: inside_c, bird: merel, rank: 1, count: 2, bird_name_cache: "Merel")
    EntryBirdCount.create!(entry: outside_bbox, bird: ekster, rank: 1, count: 8, bird_name_cache: "Ekster")

    get "/api/v1/areas/groningen/species_grid", params: {
      year: 2026,
      bird_id: 9,
      metric: "presence",
      bbox: "6.55,53.21,6.58,53.23",
      cell_size_m: 100000,
      min_n: 1,
    }

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 9, body["bird_id"]
    assert_equal "presence", body["metric"]
    assert_equal 100000, body["cell_size_m"]
    assert_equal 1, body["min_n"]
    assert_equal [6.55, 53.21, 6.58, 53.23], body.dig("filters", "bbox")
    assert_equal 1, body["cells"].length
    cell = body["cells"].first
    assert_equal 3, cell["entry_count"]
    assert_equal 2, cell["with_count"]
    assert_equal 4, cell["sum_count"]
    assert_in_delta (2.0 / 3.0), cell["value"], 0.0001
  end

  test "species grid rejects invalid parameters" do
    get "/api/v1/areas/groningen/species_grid", params: {
      year: 2026,
      bird_id: 9,
      metric: "presence",
      cell_size_m: 1000,
    }

    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_equal "invalid species grid parameters", body["error"]
  end

  test "species catalog rejects invalid parameters" do
    get "/api/v1/areas/groningen/species_catalog", params: { year: 2026, scope: "viewport" }

    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_equal "invalid species catalog parameters", body["error"]
  end

  test "species manifest rejects invalid parameters" do
    get "/api/v1/areas/groningen/species_manifest", params: { year: "not-a-year" }

    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_equal "invalid species manifest parameters", body["error"]
  end

  test "species manifest returns not found for an unknown area" do
    get "/api/v1/areas/unknown/species_manifest", params: { year: 2026 }

    assert_response :not_found
    body = JSON.parse(response.body)
    assert_equal "area not found", body["error"]
  end

  test "top birds returns not found for an unknown entry" do
    get "/api/v1/years/2025/entries/999999/top_birds"

    assert_response :not_found
    body = JSON.parse(response.body)
    assert_equal "entry not found", body["error"]
  end

  test "top birds rejects invalid parameters" do
    get "/api/v1/years/not-a-year/entries/abc/top_birds"

    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_equal "invalid entry parameters", body["error"]
  end

  test "top birds returns normalized ordered birds for an entry" do
    entry = Entry.create!(
      year: 2025,
      external_id: 463_535,
      pc4: "1011",
      lat: 52.3662666,
      lng: 4.9025050,
      is_org: false,
    )
    bird_a = Bird.create!(external_id: 79, name: "Zwarte kraai")
    bird_b = Bird.create!(external_id: 9, name: "Ekster")
    EntryBirdCount.create!(entry: entry, bird: bird_a, rank: 2, count: 2, bird_name_cache: "Zwarte kraai")
    EntryBirdCount.create!(entry: entry, bird: bird_b, rank: 1, count: 3, bird_name_cache: "Ekster")

    get "/api/v1/years/2025/entries/463535/top_birds"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 463_535, body["entry_id"]
    assert_equal 2025, body["year"]
    assert_equal 2, body["birds"].length
    assert_equal 9, body["birds"][0]["bird_id"]
    assert_equal "Ekster", body["birds"][0]["name"]
    assert_equal 3, body["birds"][0]["count"]
    assert_equal 1, body["birds"][0]["rank"]
    assert_equal 79, body["birds"][1]["bird_id"]
  end
end
