from unittest.mock import patch

from django.test import SimpleTestCase

from .ai_video_check import verify_video


class VerifyVideoDurationHandlingTests(SimpleTestCase):
    @patch("workers.ai_video_check.os.path.exists", return_value=True)
    @patch(
        "workers.ai_video_check._safe_video_stats",
        return_value={
            "fps": 30.0,
            "frames": 45,
            "duration_sec": 1.5,
            "duration_source": "metadata",
        },
    )
    @patch(
        "workers.ai_video_check.screen_video_check",
        return_value={"ok": True, "is_screen_video": False},
    )
    @patch(
        "workers.ai_video_check.detect_toilet",
        return_value={"ok": True, "toilet_detected": True},
    )
    def test_uses_reported_duration_when_server_duration_is_lower(
        self,
        _mock_detect_toilet,
        _mock_screen_video_check,
        _mock_safe_video_stats,
        _mock_exists,
    ):
        result = verify_video("dummy.mp4", reported_duration_sec=15)

        self.assertTrue(result["approved"])
        stats = result["checks"]["video_stats"]
        self.assertEqual(stats["duration_source"], "server_client_max")
        self.assertEqual(stats["effective_duration_sec"], 15.0)
        self.assertEqual(stats["server_detected_duration_sec"], 1.5)

    @patch("workers.ai_video_check.os.path.exists", return_value=True)
    @patch(
        "workers.ai_video_check._safe_video_stats",
        return_value={
            "fps": 30.0,
            "frames": 42,
            "duration_sec": 1.4,
            "duration_source": "metadata",
        },
    )
    def test_short_video_message_includes_detected_duration(
        self,
        _mock_safe_video_stats,
        _mock_exists,
    ):
        result = verify_video("dummy.mp4")

        self.assertFalse(result["approved"])
        self.assertIn("duration not accepted (1.4s)", result["message"])
        self.assertIn("15 seconds", result["message"])

    @patch("workers.ai_video_check.os.path.exists", return_value=True)
    @patch(
        "workers.ai_video_check._safe_video_stats",
        return_value={
            "fps": 0.0,
            "frames": 0,
            "duration_sec": 0.0,
            "duration_source": "metadata",
        },
    )
    @patch(
        "workers.ai_video_check.screen_video_check",
        return_value={"ok": True, "is_screen_video": False},
    )
    @patch(
        "workers.ai_video_check.detect_toilet",
        return_value={"ok": True, "toilet_detected": True},
    )
    def test_uses_reported_duration_when_server_duration_missing(
        self,
        _mock_detect_toilet,
        _mock_screen_video_check,
        _mock_safe_video_stats,
        _mock_exists,
    ):
        result = verify_video("dummy.mp4", reported_duration_sec=15)

        self.assertTrue(result["approved"])
        stats = result["checks"]["video_stats"]
        self.assertEqual(stats["duration_source"], "client_reported")
        self.assertEqual(stats["effective_duration_sec"], 15.0)

    @patch("workers.ai_video_check.os.path.exists", return_value=True)
    @patch(
        "workers.ai_video_check._safe_video_stats",
        return_value={
            "fps": 30.0,
            "frames": 300,
            "duration_sec": 10.0,
            "duration_source": "metadata",
        },
    )
    def test_rejects_non_15_second_video_with_time_limit_message(
        self,
        _mock_safe_video_stats,
        _mock_exists,
    ):
        result = verify_video("dummy.mp4")

        self.assertFalse(result["approved"])
        self.assertIn("duration not accepted", result["message"])
        self.assertIn("15 seconds", result["message"])

    @patch("workers.ai_video_check.os.path.exists", return_value=True)
    @patch(
        "workers.ai_video_check._safe_video_stats",
        return_value={
            "fps": 30.0,
            "frames": 450,
            "duration_sec": 15.0,
            "duration_source": "metadata",
        },
    )
    @patch(
        "workers.ai_video_check.screen_video_check",
        return_value={
            "ok": True,
            "is_screen_video": True,
            "sampled_frames": 20,
            "screen_like_frames": 16,
            "screen_like_ratio": 0.8,
        },
    )
    def test_screen_video_rejection_message_includes_frame_counts(
        self,
        _mock_screen_video_check,
        _mock_safe_video_stats,
        _mock_exists,
    ):
        result = verify_video("dummy.mp4")

        self.assertFalse(result["approved"])
        self.assertIn("Screen Recorded Video Detected", result["message"])
        self.assertIn("16/20", result["message"])

    @patch("workers.ai_video_check.os.path.exists", return_value=True)
    @patch(
        "workers.ai_video_check._safe_video_stats",
        return_value={
            "fps": 30.0,
            "frames": 450,
            "duration_sec": 15.0,
            "duration_source": "metadata",
        },
    )
    @patch(
        "workers.ai_video_check.screen_video_check",
        return_value={"ok": True, "is_screen_video": False},
    )
    @patch(
        "workers.ai_video_check.detect_toilet",
        return_value={"ok": True, "toilet_detected": False},
    )
    def test_toilet_object_mismatch_message(
        self,
        _mock_detect_toilet,
        _mock_screen_video_check,
        _mock_safe_video_stats,
        _mock_exists,
    ):
        result = verify_video("dummy.mp4")

        self.assertFalse(result["approved"])
        self.assertIn("Toilet object not matched", result["message"])
