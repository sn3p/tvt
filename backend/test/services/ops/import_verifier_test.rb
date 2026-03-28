require "test_helper"
require "fileutils"

class OpsImportVerifierTest < ActiveSupport::TestCase
  setup do
    EntryTileMembership.delete_all
    EntryBirdCount.delete_all
    Bird.delete_all
    Entry.delete_all
  end

  test "verify_year reports matching counts for imported data" do
    Dir.mktmpdir do |tmpdir|
      root = Pathname.new(tmpdir)
      FileUtils.mkdir_p(root.join("data/raw/2025/entry_index/type1"))
      FileUtils.mkdir_p(root.join("data/raw/2025/entry_index/isorg"))
      FileUtils.mkdir_p(root.join("data/raw/2025/entry_top_birds"))

      root.join("data/raw/2025/entry_index/type1/sample.ndjson").write([
        { id: 101, pc4: "9721", lat: 53.2194, lng: 6.5665, fetched_at: "2026-01-01T10:00:00Z" }.to_json,
        { id: 202, pc4: "1011", lat: 52.3676, lng: 4.9041, fetched_at: "2026-01-01T10:00:00Z" }.to_json,
      ].join("
") + "
")
      root.join("data/raw/2025/entry_index/isorg/sample.ndjson").write([
        { id: 202, pc4: "1011", lat: 52.3676, lng: 4.9041, fetched_at: "2026-01-01T10:00:00Z" }.to_json,
      ].join("
") + "
")
      root.join("data/raw/2025/entry_top_birds/sample.ndjson").write([
        { id: 101, status: "ok", fetched_at: "2026-01-01T10:00:00Z", data: { data: [{ id: 9, number: 3, order: 1, name: "Ekster" }] } }.to_json,
        { id: 202, status: "ok", fetched_at: "2026-01-01T10:00:00Z", data: { data: [{ id: 79, number: 2, order: 1, name: "Zwarte kraai" }] } }.to_json,
      ].join("
") + "
")

      source = Imports::HarvestSource.new(root: root)
      Imports::YearImporter.new(source:).import_year(2025)

      result = Ops::ImportVerifier.new(source:).verify_year(2025)

      assert result.ok
      assert_equal [], result.mismatches
      assert_equal 2, result.expected[:entries_count]
      assert_equal 1, result.expected[:private_entries_count]
      assert_equal 1, result.expected[:isorg_entries_count]
      assert_equal 2, result.expected[:top_bird_rows_count]
      assert_equal 8, result.expected.dig(:tile_memberships, :private)
      assert_equal 8, result.expected.dig(:tile_memberships, :isorg)
      assert_equal result.expected, result.actual
    end
  end
end
