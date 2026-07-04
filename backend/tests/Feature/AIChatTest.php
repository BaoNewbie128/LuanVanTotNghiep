<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class AIChatTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.vilao_llm.key', 'test-vilao-key');
        config()->set('services.vilao_llm.url', 'https://api.vilao.ai/v1');
        config()->set('services.vilao_llm.model', 'botzalo');
    }

    public function test_it_returns_a_readable_ai_reply_for_text_description(): void
    {
        Http::fake([
            'http://127.0.0.1:5000/predict_text' => Http::response([
                'results' => [
                    ['label' => 'gtr_r34', 'score' => 0.9532],
                ],
            ]),
        ]);

        $response = $this->postJson('/api/ai/chat', [
            'message' => 'blue skyline coupe twin turbo',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('mode', 'text')
            ->assertJsonPath('results.0.label', 'gtr_r34')
            ->assertJsonFragment(['reply' => 'Dòng xe phù hợp nhất với mô tả của bạn là Nissan Skyline GT-R R34 (mức tương đồng 95,3%). Bạn có thể gửi thêm ảnh để AI nhận diện chính xác hơn.']);
    }

    public function test_message_or_image_is_required(): void
    {
        $this->postJson('/api/ai/chat')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['message', 'image']);
    }

    public function test_it_falls_back_gracefully_when_ai_service_is_unavailable(): void
    {
        Http::fake([
            'http://127.0.0.1:5000/predict_text' => Http::response(['error' => 'offline'], 500),
            'https://api.vilao.ai/v1/chat/completions' => Http::response(['error' => 'offline'], 500),
        ]);

        $this->postJson('/api/ai/chat', ['message' => 'red Nissan Skyline GTR turbo car'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('intent', 'vehicle_clarification')
            ->assertJsonPath('results', []);
    }

    public function test_it_uses_llm_search_when_trained_semantic_service_is_unavailable(): void
    {
        Http::fake([
            'http://127.0.0.1:5000/predict_text' => Http::response(['error' => 'offline'], 500),
            'https://api.vilao.ai/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => ['content' => '{"action":"select","label":"rx7_fc"}'],
                ]],
            ]),
        ]);

        $this->postJson('/api/ai/chat', ['message' => 'Mazda đời 80 dùng động cơ rotary'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('results.0.label', 'rx7_fc')
            ->assertJsonPath('results.0.source', 'llm_fallback');
    }

    public function test_it_uses_llm_for_a_shipping_question_without_calling_car_model(): void
    {
        Http::fake([
            'https://api.vilao.ai/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => ['content' => '**Nội thành** giao trong 1–2 ngày, tỉnh khác khoảng 3–5 ngày.'],
                ]],
            ]),
        ]);

        $this->postJson('/api/ai/chat', ['message' => 'Shop giao hàng mất bao lâu?'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('mode', 'llm')
            ->assertJsonPath('intent', 'shipping')
            ->assertJsonPath('reply', 'Nội thành giao trong 1–2 ngày, tỉnh khác khoảng 3–5 ngày.')
            ->assertJsonPath('results', []);

        Http::assertSent(fn ($request) => $request->url() === 'https://api.vilao.ai/v1/chat/completions'
            && $request['model'] === 'botzalo'
            && $request->hasHeader('Authorization', 'Bearer test-vilao-key'));
    }

    public function test_it_uses_llm_instead_of_classifying_an_unrelated_question_as_a_car(): void
    {
        Http::fake([
            'https://api.vilao.ai/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => ['content' => 'Mình không có dữ liệu thời tiết trực tiếp.'],
                ]],
            ]),
        ]);

        $this->postJson('/api/ai/chat', ['message' => 'Hôm nay thời tiết thế nào?'])
            ->assertOk()
            ->assertJsonPath('mode', 'llm')
            ->assertJsonPath('intent', 'out_of_scope')
            ->assertJsonPath('reply', 'Mình không có dữ liệu thời tiết trực tiếp.')
            ->assertJsonPath('results', []);
    }

    public function test_it_returns_a_safe_error_when_llm_is_unavailable(): void
    {
        Http::fake([
            'https://api.vilao.ai/v1/chat/completions' => Http::response(['error' => 'offline'], 500),
        ]);

        $this->postJson('/api/ai/chat', ['message' => 'Hãy kể một câu chuyện ngắn'])
            ->assertStatus(503)
            ->assertJsonPath('success', false);
    }

    public function test_it_asks_for_details_instead_of_guessing_a_car_from_a_generic_request(): void
    {
        Http::preventStrayRequests();

        $this->postJson('/api/ai/chat', ['message' => 'Tôi muốn tìm mô hình xe'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('mode', 'general')
            ->assertJsonPath('intent', 'vehicle_clarification')
            ->assertJsonPath('results', []);
    }

    public function test_it_asks_for_model_when_only_a_brand_is_provided(): void
    {
        Http::preventStrayRequests();

        $this->postJson('/api/ai/chat', ['message' => 'Tôi muốn tìm xe Toyota'])
            ->assertOk()
            ->assertJsonPath('intent', 'vehicle_clarification')
            ->assertJsonPath('results', []);
    }

    public function test_it_resolves_an_explicit_model_without_calling_external_ai(): void
    {
        Http::preventStrayRequests();

        $this->postJson('/api/ai/chat', ['message' => 'Tôi muốn tìm Toyota Supra MK4'])
            ->assertOk()
            ->assertJsonPath('mode', 'text')
            ->assertJsonPath('results.0.label', 'supra_mk4')
            ->assertJsonPath('results.0.source', 'exact_alias');
    }

    public function test_it_resolves_brians_car_without_calling_external_ai(): void
    {
        Http::preventStrayRequests();

        $this->postJson('/api/ai/chat', ['message' => 'Tôi muốn tìm xe của Brian'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('mode', 'text')
            ->assertJsonPath('results.0.label', 'gtr_r34')
            ->assertJsonPath('results.0.source', 'exact_alias');
    }

    public function test_it_resolves_fast_and_furious_to_the_iconic_r34_without_external_ai(): void
    {
        Http::preventStrayRequests();

        $this->postJson('/api/ai/chat', ['message' => 'Xe trong fast and furious'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('mode', 'text')
            ->assertJsonPath('results.0.label', 'gtr_r34')
            ->assertJsonPath('results.0.source', 'exact_alias');
    }

    public function test_it_resolves_tokyo_drift_to_hans_rx7_without_external_ai(): void
    {
        Http::preventStrayRequests();

        $this->postJson('/api/ai/chat', ['message' => 'Xe trong phim tokyo drift'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('mode', 'text')
            ->assertJsonPath('results.0.label', 'rx7_fd')
            ->assertJsonPath('results.0.source', 'exact_alias');
    }

    public function test_it_uses_the_trained_text_dataset_for_god_hand(): void
    {
        Http::preventStrayRequests();

        $this->postJson('/api/ai/chat', ['message' => 'Xe của God hand'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('mode', 'text')
            ->assertJsonPath('results.0.label', 's2000')
            ->assertJsonPath('results.0.source', 'trained_dataset');
    }

    public function test_it_uses_the_trained_text_dataset_for_suki(): void
    {
        Http::preventStrayRequests();

        $this->postJson('/api/ai/chat', ['message' => 'Xe của Suki'])
            ->assertOk()
            ->assertJsonPath('results.0.label', 's2000')
            ->assertJsonPath('results.0.source', 'trained_dataset');
    }

    public function test_it_lists_trained_candidates_for_an_ambiguous_initial_d_query(): void
    {
        Http::preventStrayRequests();

        $this->postJson('/api/ai/chat', ['message' => 'Xe trong Initial D'])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('mode', 'general')
            ->assertJsonPath('intent', 'vehicle_clarification')
            ->assertJsonPath('results', [])
            ->assertJsonStructure(['suggestions']);
    }

    public function test_llm_can_verify_an_ambiguous_clip_prediction(): void
    {
        Http::fake([
            'http://127.0.0.1:5000/predict_text' => Http::response([
                'results' => [
                    ['label' => 'rx7_fc', 'score' => 0.741],
                    ['label' => 'impreza', 'score' => 0.735],
                    ['label' => 'gtr_r34', 'score' => 0.701],
                ],
            ]),
            'https://api.vilao.ai/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => ['content' => '{"action":"select","label":"impreza"}'],
                ]],
            ]),
        ]);

        $this->postJson('/api/ai/chat', ['message' => 'xe coupe đèn ngủ dẫn động cầu sau'])
            ->assertOk()
            ->assertJsonPath('results.0.label', 'impreza')
            ->assertJsonPath('results.0.source', 'clip_llm_verified');
    }

    public function test_brand_constraint_can_correct_clip_top_one(): void
    {
        Http::fake([
            'http://127.0.0.1:5000/predict_text' => Http::response([
                'results' => [
                    ['label' => 'rx7_fc', 'score' => 0.741],
                    ['label' => 'impreza', 'score' => 0.735],
                    ['label' => 'gtr_r34', 'score' => 0.701],
                ],
            ]),
        ]);

        $this->postJson('/api/ai/chat', ['message' => 'xe Subaru màu xanh AWD'])
            ->assertOk()
            ->assertJsonPath('results.0.label', 'impreza')
            ->assertJsonPath('results.0.source', 'clip_brand_verified');
    }

    public function test_it_rejects_a_low_confidence_image_instead_of_filtering_the_wrong_car(): void
    {
        Http::fake([
            'http://127.0.0.1:5000/predict' => Http::response([
                'results' => [
                    ['label' => 'rx7_fd', 'confidence' => 47.49],
                    ['label' => 'supra_mk4', 'confidence' => 22.10],
                ],
            ]),
        ]);

        $this->post('/api/ai/chat', [
            'image' => UploadedFile::fake()->image('unclear-car.jpg'),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('intent', 'vehicle_clarification')
            ->assertJsonPath('results', []);
    }
}
